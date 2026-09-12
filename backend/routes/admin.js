const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { notifyStudents } = require('../db/notifications');

const router = express.Router();

// Every route in this file requires role === 'admin'. This is enforced
// server-side, independent of anything the frontend chooses to render —
// a Student/CR/Teacher token hitting any /api/admin/* route gets a 403.
router.use(verifyToken, requireRole('admin'));

// ---------- A. Add CR ----------
router.post('/cr', (req, res) => {
  const { name, regNo, batch, section, email, phone, bloodGroup, password } = req.body;
  if (!name || !regNo || !batch || !section || !password) {
    return res.status(400).json({ error: 'Name, Registration Number, Batch, Section and Password are required.' });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE identifier = ?`).get(regNo);
  if (existing) return res.status(409).json({ error: 'This Registration Number is already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const userInfo = db.prepare(`INSERT INTO users (role, identifier, password_hash, status) VALUES ('student', ?, ?, 'active')`).run(regNo, hash);
  db.prepare(`
    INSERT INTO students (user_id, full_name, reg_no, batch, section, email, phone, blood_group, is_cr)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(userInfo.lastInsertRowid, name, regNo, batch, section, email || '', phone || '', bloodGroup || '');

  res.status(201).json({ message: 'CR added successfully.' });
});

// ---------- B. Remove CR ----------
router.delete('/cr/:studentId', (req, res) => {
  const student = db.prepare(`SELECT * FROM students WHERE id = ? AND is_cr = 1`).get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'CR not found.' });
  db.prepare(`UPDATE users SET status = 'removed' WHERE id = ?`).run(student.user_id);
  db.prepare(`UPDATE students SET is_cr = 0 WHERE id = ?`).run(student.id);
  res.json({ message: 'CR removed/deactivated.' });
});

router.get('/crs', (req, res) => {
  res.json(db.prepare(`
    SELECT s.*, u.status FROM students s JOIN users u ON u.id = s.user_id WHERE s.is_cr = 1 ORDER BY s.batch, s.section
  `).all());
});

// ---------- C. Add Teacher ----------
router.post('/teacher', (req, res) => {
  const { name, teacherId, email, phone, password } = req.body;
  if (!name || !teacherId || !password) {
    return res.status(400).json({ error: 'Teacher Name, Teacher ID and Password are required.' });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE identifier = ?`).get(teacherId);
  if (existing) return res.status(409).json({ error: 'This Teacher ID is already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const userInfo = db.prepare(`INSERT INTO users (role, identifier, password_hash, status) VALUES ('teacher', ?, ?, 'active')`).run(teacherId, hash);
  db.prepare(`INSERT INTO teachers (user_id, name, teacher_id, email, phone) VALUES (?, ?, ?, ?, ?)`)
    .run(userInfo.lastInsertRowid, name, teacherId, email || '', phone || '');

  res.status(201).json({ message: 'Teacher added successfully.' });
});

// ---------- D. Remove Teacher ----------
router.delete('/teacher/:teacherId', (req, res) => {
  const teacher = db.prepare(`SELECT * FROM teachers WHERE id = ?`).get(req.params.teacherId);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
  db.prepare(`UPDATE users SET status = 'removed' WHERE id = ?`).run(teacher.user_id);
  res.json({ message: 'Teacher removed/deactivated.' });
});

router.get('/teachers', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, u.status FROM teachers t JOIN users u ON u.id = t.user_id ORDER BY t.name
  `).all());
});

// ---------- E. Student registration verification ----------
router.get('/students/pending', (req, res) => {
  res.json(db.prepare(`
    SELECT s.*, u.status FROM students s JOIN users u ON u.id = s.user_id WHERE u.status = 'pending' ORDER BY s.id DESC
  `).all());
});

router.post('/students/:id/approve', (req, res) => {
  const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  db.prepare(`UPDATE users SET status = 'active' WHERE id = ?`).run(student.user_id);
  res.json({ message: 'Student approved.' });
});

router.post('/students/:id/reject', (req, res) => {
  const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  db.prepare(`UPDATE users SET status = 'rejected' WHERE id = ?`).run(student.user_id);
  res.json({ message: 'Student registration rejected.' });
});

// All students list + remove any student
router.get('/students', (req, res) => {
  res.json(db.prepare(`
    SELECT s.*, u.status FROM students s JOIN users u ON u.id = s.user_id ORDER BY u.status, s.batch, s.section, s.full_name
  `).all());
});

router.delete('/students/:id', (req, res) => {
  const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  db.prepare(`UPDATE users SET status = 'removed' WHERE id = ?`).run(student.user_id);
  res.json({ message: 'Student removed from the system.' });
});

// ---------- Setup data: batches/sections/courses/fixed routines & notices ----------
router.post('/courses', (req, res) => {
  const { code, title } = req.body;
  if (!code || !title) return res.status(400).json({ error: 'Course code and title are required.' });
  try {
    const info = db.prepare(`INSERT INTO courses (code, title) VALUES (?, ?)`).run(code, title);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(409).json({ error: 'Course code already exists.' });
  }
});
router.get('/courses', (req, res) => res.json(db.prepare(`SELECT * FROM courses ORDER BY code`).all()));

// Class/exam/lab hours are restricted to 8:00 AM – 5:00 PM department-wide.
const CLASS_HOURS_START = '08:00';
const CLASS_HOURS_END = '17:00';
function isWithinClassHours(startTime, endTime) {
  return startTime < endTime && startTime >= CLASS_HOURS_START && endTime <= CLASS_HOURS_END;
}

router.post('/routines', (req, res) => {
  const { batch, section, courseId, teacherId, dayOfWeek, startTime, endTime, room, type } = req.body;
  if (!batch || !section || !courseId || !teacherId || !dayOfWeek || !startTime || !endTime || !room) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!isWithinClassHours(startTime, endTime)) {
    return res.status(400).json({ error: 'Class time must be between 8:00 AM and 5:00 PM, and start before it ends.' });
  }

  // A fixed routine repeats every week on the same day, so a conflict means
  // the same room is already booked on the same day-of-week with an
  // overlapping time — regardless of which batch/section that other entry
  // belongs to. Two different courses can never share a room at once.
  const conflict = db.prepare(`
    SELECT r.*, c.code course_code FROM routines r LEFT JOIN courses c ON c.id = r.course_id
    WHERE r.room = ? AND r.day_of_week = ?
      AND NOT (r.end_time <= ? OR r.start_time >= ?)
  `).get(room, dayOfWeek, startTime, endTime);
  if (conflict) {
    return res.status(409).json({
      error: `Room ${room} is already booked on ${dayOfWeek} from ${conflict.start_time} to ${conflict.end_time} (${conflict.course_code}, ${conflict.batch} Sec ${conflict.section}).`
    });
  }

  const info = db.prepare(`
    INSERT INTO routines (batch, section, course_id, teacher_id, day_of_week, start_time, end_time, room, type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batch, section, courseId, teacherId, dayOfWeek, startTime, endTime, room, type || 'class');
  res.status(201).json({ id: info.lastInsertRowid });
});
router.get('/routines', (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, c.code course_code, c.title course_title, t.name teacher_name
    FROM routines r LEFT JOIN courses c ON c.id = r.course_id LEFT JOIN teachers t ON t.id = r.teacher_id
    ORDER BY r.batch, r.section, r.day_of_week, r.start_time
  `).all());
});
router.delete('/routines/:id', (req, res) => {
  db.prepare(`DELETE FROM routines WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Routine entry removed.' });
});

// Administration notices (with optional PDF)
router.post('/notices', upload.single('file'), (req, res) => {
  const { title, description, batch } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare(`
    INSERT INTO notices (source, title, description, batch, file_path, created_by) VALUES ('admin', ?, ?, ?, ?, ?)
  `).run(title, description || '', batch || null, filePath, req.user.id);
  notifyStudents({ batch: batch || null, section: null, title: `Notice: ${title}`, body: description || '', type: 'admin_notice' });
  res.status(201).json({ message: 'Notice published.' });
});
router.get('/notices', (req, res) => {
  res.json(db.prepare(`SELECT * FROM notices WHERE source = 'admin' ORDER BY created_at DESC`).all());
});
router.delete('/notices/:id', (req, res) => {
  db.prepare(`DELETE FROM notices WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Notice deleted.' });
});

// Materials management (drive links per batch)
router.post('/materials', (req, res) => {
  const { batch, title, link } = req.body;
  if (!batch || !title || !link) return res.status(400).json({ error: 'Batch, title and link are required.' });
  db.prepare(`INSERT INTO materials (batch, title, link, created_by) VALUES (?, ?, ?, ?)`).run(batch, title, link, req.user.id);
  res.status(201).json({ message: 'Material added.' });
});
router.get('/materials', (req, res) => {
  res.json(db.prepare(`SELECT * FROM materials ORDER BY created_at DESC`).all());
});

// Simple dashboard stats
router.get('/stats', (req, res) => {
  const stats = {
    totalStudents: db.prepare(`SELECT COUNT(*) c FROM students WHERE is_cr = 0`).get().c,
    totalCRs: db.prepare(`SELECT COUNT(*) c FROM students WHERE is_cr = 1`).get().c,
    totalTeachers: db.prepare(`SELECT COUNT(*) c FROM teachers`).get().c,
    pendingApprovals: db.prepare(`SELECT COUNT(*) c FROM users WHERE status = 'pending'`).get().c,
  };
  res.json(stats);
});

module.exports = router;
