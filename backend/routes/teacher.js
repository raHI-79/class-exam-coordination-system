const express = require('express');
const db = require('../db/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { notifyStudents, notifyUser } = require('../db/notifications');

const router = express.Router();
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getSelf(req) {
  return db.prepare(`SELECT * FROM teachers WHERE user_id = ?`).get(req.user.id);
}

router.use(verifyToken, requireRole('teacher'));

router.get('/me', (req, res) => {
  const t = getSelf(req);
  if (!t) return res.status(404).json({ error: 'Teacher profile not found.' });
  res.json(t);
});

// A. Daily class schedule (fixed weekly routine + approved dated events) for a chosen date
router.get('/schedule', (req, res) => {
  const teacher = getSelf(req);
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const dayName = DAYS[new Date(dateStr + 'T00:00:00').getDay()];

  const fixed = db.prepare(`
    SELECT r.*, c.code course_code, c.title course_title
    FROM routines r LEFT JOIN courses c ON c.id = r.course_id
    WHERE r.teacher_id = ? AND r.day_of_week = ?
    ORDER BY r.start_time
  `).all(teacher.id, dayName);

  const events = db.prepare(`
    SELECT e.*, c.code course_code, c.title course_title
    FROM class_events e LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.teacher_id = ? AND e.date = ? AND e.status = 'approved'
    ORDER BY e.start_time
  `).all(teacher.id, dateStr);

  res.json({ date: dateStr, day: dayName, fixedClasses: fixed, scheduledEvents: events });
});

// B. Pending class/exam/extra-class requests awaiting this teacher's approval
router.get('/requests/pending', (req, res) => {
  const teacher = getSelf(req);
  const rows = db.prepare(`
    SELECT e.*, c.code course_code, c.title course_title,
           (SELECT full_name FROM students s WHERE s.user_id = e.created_by) as requested_by
    FROM class_events e LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.teacher_id = ? AND e.status = 'pending'
    ORDER BY e.date, e.start_time
  `).all(teacher.id);
  res.json(rows);
});

router.post('/requests/:id/approve', (req, res) => {
  const teacher = getSelf(req);
  const event = db.prepare(`SELECT * FROM class_events WHERE id = ? AND teacher_id = ?`).get(req.params.id, teacher.id);
  if (!event) return res.status(404).json({ error: 'Request not found.' });
  db.prepare(`UPDATE class_events SET status = 'approved' WHERE id = ?`).run(req.params.id);

  notifyUser({
    userId: event.created_by,
    title: `Approved: ${event.event_type} on ${event.date}`,
    body: `${teacher.name} approved your ${event.date} ${event.start_time}-${event.end_time} request in Room ${event.room}.`,
    type: 'request_approved'
  });
  notifyStudents({
    batch: event.batch, section: event.section,
    title: `New ${event.event_type} scheduled — ${event.date}`,
    body: `${event.start_time}-${event.end_time} @ Room ${event.room}.`,
    type: 'class_scheduled'
  });

  res.json({ message: 'Approved. This is now visible to students.' });
});

router.post('/requests/:id/reject', (req, res) => {
  const teacher = getSelf(req);
  const event = db.prepare(`SELECT * FROM class_events WHERE id = ? AND teacher_id = ?`).get(req.params.id, teacher.id);
  if (!event) return res.status(404).json({ error: 'Request not found.' });
  db.prepare(`UPDATE class_events SET status = 'rejected' WHERE id = ?`).run(req.params.id);

  notifyUser({
    userId: event.created_by,
    title: `Rejected: ${event.event_type} on ${event.date}`,
    body: `${teacher.name} rejected your ${event.date} ${event.start_time}-${event.end_time} request in Room ${event.room}.`,
    type: 'request_rejected'
  });

  res.json({ message: 'Rejected. The CR will see this was rejected.' });
});

// D. Cancel an already-approved scheduled class — teachers can do this at
// any time (no date restriction), for any of their own approved classes.
// GET /events/upcoming lists candidates without requiring the teacher to
// hunt through one date at a time first.
router.get('/events/upcoming', (req, res) => {
  const teacher = getSelf(req);
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT e.*, c.code course_code, c.title course_title
    FROM class_events e LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.teacher_id = ? AND e.status = 'approved' AND e.date >= ?
    ORDER BY e.date, e.start_time
  `).all(teacher.id, today);
  res.json(rows);
});

router.post('/events/:id/cancel', (req, res) => {
  const teacher = getSelf(req);
  const event = db.prepare(`SELECT * FROM class_events WHERE id = ? AND teacher_id = ?`).get(req.params.id, teacher.id);
  if (!event) return res.status(404).json({ error: 'Class not found.' });
  db.prepare(`UPDATE class_events SET status = 'cancelled' WHERE id = ?`).run(req.params.id);

  notifyStudents({
    batch: event.batch, section: event.section,
    title: `Class cancelled — ${event.date}`,
    body: `${teacher.name} cancelled the ${event.start_time}-${event.end_time} ${event.event_type} in Room ${event.room}.`,
    type: 'class_cancelled'
  });
  notifyUser({
    userId: event.created_by,
    title: `Class cancelled — ${event.date}`,
    body: `${teacher.name} cancelled the ${event.start_time}-${event.end_time} ${event.event_type} in Room ${event.room}.`,
    type: 'class_cancelled'
  });

  res.json({ message: 'Class cancelled. Students will see the cancellation.' });
});

// C. Messages from CRs (direct thread), with reply + optional PDF
router.get('/messages/inbox', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM messages WHERE target_type = 'teacher' AND target_user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

router.get('/messages/with-cr/:crUserId', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND target_user_id = ?) OR (sender_id = ? AND target_user_id = ?)
    ORDER BY created_at ASC
  `).all(req.user.id, req.params.crUserId, req.params.crUserId, req.user.id);
  res.json(rows);
});

router.post('/messages/reply', upload.single('file'), (req, res) => {
  const teacher = getSelf(req);
  const { crUserId, content } = req.body;
  if (!crUserId) return res.status(400).json({ error: 'crUserId is required.' });
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(`
    INSERT INTO messages (sender_id, sender_role, sender_name, target_type, target_user_id, content, file_path)
    VALUES (?, 'teacher', ?, 'cr', ?, ?, ?)
  `).run(req.user.id, teacher.name, crUserId, content || '', filePath);

  notifyUser({
    userId: crUserId,
    title: `Reply from ${teacher.name}`,
    body: content || (filePath ? 'Sent an attachment.' : ''),
    type: 'teacher_reply'
  });

  res.status(201).json({ message: 'Reply sent.' });
});

// ---------- Lookups for teacher-initiated messaging ----------
router.get('/lookups/crs', (req, res) => {
  const rows = db.prepare(`
    SELECT s.user_id, s.full_name, s.batch, s.section
    FROM students s JOIN users u ON u.id = s.user_id
    WHERE s.is_cr = 1 AND u.status = 'active'
    ORDER BY s.batch, s.section
  `).all();
  res.json(rows);
});

router.get('/lookups/batches', (req, res) => {
  const rows = db.prepare(`SELECT DISTINCT batch FROM students ORDER BY batch`).all();
  res.json(rows.map(r => r.batch));
});

router.get('/lookups/sections', (req, res) => {
  const { batch } = req.query;
  const rows = batch
    ? db.prepare(`SELECT DISTINCT section FROM students WHERE batch = ? ORDER BY section`).all(batch)
    : db.prepare(`SELECT DISTINCT section FROM students ORDER BY section`).all();
  res.json(rows.map(r => r.section));
});

// Simple search-as-you-type student lookup for messaging a specific student.
router.get('/lookups/students', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT s.user_id, s.full_name, s.reg_no, s.batch, s.section
      FROM students s JOIN users u ON u.id = s.user_id
      WHERE u.status = 'active' AND (s.full_name LIKE ? OR s.reg_no LIKE ?)
      ORDER BY s.full_name LIMIT 20
    `).all(like, like);
  } else {
    rows = db.prepare(`
      SELECT s.user_id, s.full_name, s.reg_no, s.batch, s.section
      FROM students s JOIN users u ON u.id = s.user_id
      WHERE u.status = 'active'
      ORDER BY s.full_name LIMIT 20
    `).all();
  }
  res.json(rows);
});

// ---------- Teacher-initiated message/notice: to a CR, a batch (all
// students, or one section), or one specific student — with optional PDF.
router.post('/messages/send', upload.single('file'), (req, res) => {
  const teacher = getSelf(req);
  const { targetType, crUserId, targetBatch, targetSection, studentUserId, content } = req.body;
  if (!targetType) return res.status(400).json({ error: 'targetType is required.' });
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (targetType === 'cr') {
    if (!crUserId) return res.status(400).json({ error: 'Please choose a CR.' });
    db.prepare(`
      INSERT INTO messages (sender_id, sender_role, sender_name, target_type, target_user_id, content, file_path)
      VALUES (?, 'teacher', ?, 'cr', ?, ?, ?)
    `).run(req.user.id, teacher.name, crUserId, content || '', filePath);
    notifyUser({ userId: crUserId, title: `Message from ${teacher.name}`, body: content || (filePath ? 'Sent an attachment.' : ''), type: 'teacher_message' });
    return res.status(201).json({ message: 'Sent to CR.' });

  } else if (targetType === 'batch') {
    if (!targetBatch) return res.status(400).json({ error: 'Please choose a batch.' });
    db.prepare(`
      INSERT INTO messages (sender_id, sender_role, sender_name, target_type, target_batch, target_section, content, file_path)
      VALUES (?, 'teacher', ?, 'student_broadcast', ?, ?, ?, ?)
    `).run(req.user.id, teacher.name, targetBatch, targetSection || null, content || '', filePath);
    notifyStudents({
      batch: targetBatch, section: targetSection || null,
      title: `Message from ${teacher.name}`, body: content || '', type: 'teacher_message'
    });
    return res.status(201).json({ message: `Sent to ${targetBatch}${targetSection ? ' Sec ' + targetSection : ''}.` });

  } else if (targetType === 'student') {
    if (!studentUserId) return res.status(400).json({ error: 'Please choose a student.' });
    db.prepare(`
      INSERT INTO messages (sender_id, sender_role, sender_name, target_type, target_user_id, content, file_path)
      VALUES (?, 'teacher', ?, 'student', ?, ?, ?)
    `).run(req.user.id, teacher.name, studentUserId, content || '', filePath);
    notifyUser({ userId: studentUserId, title: `Message from ${teacher.name}`, body: content || (filePath ? 'Sent an attachment.' : ''), type: 'teacher_message' });
    return res.status(201).json({ message: 'Sent to student.' });
  }

  res.status(400).json({ error: 'Invalid targetType.' });
});

// Inbox: messages/notices this teacher has sent (so they can see history)
router.get('/messages/sent', (req, res) => {
  const rows = db.prepare(`SELECT * FROM messages WHERE sender_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(rows);
});

module.exports = router;
