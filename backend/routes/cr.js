const express = require('express');
const db = require('../db/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { notifyStudents, notifyUser } = require('../db/notifications');

const router = express.Router();
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getSelf(req) {
  return db.prepare(`SELECT * FROM students WHERE user_id = ?`).get(req.user.id);
}

// Every route here is locked to role 'cr' on the backend — a CR can never
// reach another section's controls because every query is scoped to
// this CR's own batch+section pulled from their authenticated profile.
router.use(verifyToken, requireRole('cr'));

router.get('/me', (req, res) => {
  const cr = getSelf(req);
  if (!cr || !cr.is_cr) return res.status(403).json({ error: '403 Access Denied / Unauthorized Access' });
  res.json(cr);
});

// A. Fixed routine of CR's own assigned batch & section
router.get('/routine/fixed', (req, res) => {
  const cr = getSelf(req);
  const routine = db.prepare(`
    SELECT r.*, c.code course_code, c.title course_title, t.id teacher_id, t.name teacher_name
    FROM routines r LEFT JOIN courses c ON c.id = r.course_id LEFT JOIN teachers t ON t.id = r.teacher_id
    WHERE r.batch = ? AND r.section = ?
    ORDER BY r.day_of_week, r.start_time
  `).all(cr.batch, cr.section);
  res.json(routine);
});

// Class/exam/extra-class hours are restricted to 8:00 AM – 5:00 PM.
const CLASS_HOURS_START = '08:00';
const CLASS_HOURS_END = '17:00';
function isWithinClassHours(startTime, endTime) {
  return startTime < endTime && startTime >= CLASS_HOURS_START && endTime <= CLASS_HOURS_END;
}

// Checks whether a room is free at date+startTime-endTime for `ownBatch`.
// A room counts as taken if:
//  - any OTHER batch already has a pending/approved dated booking there, or
//  - the Fixed Routine has ANOTHER batch's recurring class in that room on
//    that day-of-week overlapping that time (the CR's OWN batch's fixed
//    routine slot in that same room/time is NOT a conflict — it's already
//    theirs).
// Returns an error message string if unavailable, otherwise null.
function roomConflictMessage(room, date, startTime, endTime, ownBatch) {
  const datedConflict = db.prepare(`
    SELECT batch FROM class_events
    WHERE room = ? AND date = ? AND status IN ('pending','approved')
      AND NOT (end_time <= ? OR start_time >= ?)
  `).get(room, date, startTime, endTime);
  if (datedConflict) return 'This room is not available at the selected time.';

  const dayOfWeek = DAYS[new Date(date + 'T00:00:00').getDay()];
  const fixedConflict = db.prepare(`
    SELECT batch, section FROM routines
    WHERE room = ? AND day_of_week = ? AND batch != ?
      AND NOT (end_time <= ? OR start_time >= ?)
  `).get(room, dayOfWeek, ownBatch, startTime, endTime);
  if (fixedConflict) {
    return `Room ${room} is already used by ${fixedConflict.batch} Sec ${fixedConflict.section}'s fixed routine at this time on ${dayOfWeek}s.`;
  }
  return null;
}

router.get('/lookups/teachers', (req, res) => {
  res.json(db.prepare(`SELECT id, user_id, name, teacher_id FROM teachers ORDER BY name`).all());
});
router.get('/lookups/courses', (req, res) => {
  res.json(db.prepare(`SELECT id, code, title FROM courses ORDER BY code`).all());
});

// Lets the CR see what's already booked on a given date, across all rooms —
// both one-off dated bookings AND the recurring Fixed Routine for that
// day-of-week — so available rooms and time slots are visible up front
// instead of only being discovered after a rejected submission. Each row is
// tagged so the frontend can show "your batch" vs "another batch".
router.get('/room-schedule', (req, res) => {
  const cr = getSelf(req);
  const dateStr = req.query.date;
  if (!dateStr) return res.status(400).json({ error: 'date query param is required.' });
  const dayOfWeek = DAYS[new Date(dateStr + 'T00:00:00').getDay()];

  const dated = db.prepare(`
    SELECT e.room, e.start_time, e.end_time, e.batch, e.section, e.event_type, e.status,
           c.code course_code
    FROM class_events e LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.date = ? AND e.status IN ('pending','approved')
    ORDER BY e.room, e.start_time
  `).all(dateStr).map(r => ({ ...r, source: 'dated', isOwnBatch: r.batch === cr.batch }));

  const fixed = db.prepare(`
    SELECT r.room, r.start_time, r.end_time, r.batch, r.section, 'class' as event_type, 'fixed' as status,
           c.code course_code
    FROM routines r LEFT JOIN courses c ON c.id = r.course_id
    WHERE r.day_of_week = ?
    ORDER BY r.room, r.start_time
  `).all(dayOfWeek).map(r => ({ ...r, source: 'fixed_routine', isOwnBatch: r.batch === cr.batch }));

  const bookings = [...dated, ...fixed].sort((a, b) => a.room.localeCompare(b.room) || a.start_time.localeCompare(b.start_time));
  res.json({ date: dateStr, dayOfWeek, classHoursStart: CLASS_HOURS_START, classHoursEnd: CLASS_HOURS_END, bookings });
});

// A. Create class/exam date for next day (or any day) — goes to 'pending' until teacher approves.
// Requirement: if scheduled for "tomorrow", the teacher must approve by 11:59pm tonight or it auto-cancels.
router.post('/class-events', (req, res) => {
  const cr = getSelf(req);
  const { courseId, teacherId, date, startTime, endTime, room, eventType } = req.body;
  if (!courseId || !teacherId || !date || !startTime || !endTime || !room) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!isWithinClassHours(startTime, endTime)) {
    return res.status(400).json({ error: 'Class time must be between 8:00 AM and 5:00 PM, and start before it ends.' });
  }

  const conflictMsg = roomConflictMessage(room, date, startTime, endTime, cr.batch);
  if (conflictMsg) return res.status(409).json({ error: conflictMsg });

  const info = db.prepare(`
    INSERT INTO class_events (batch, section, course_id, teacher_id, date, start_time, end_time, room, event_type, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(cr.batch, cr.section, courseId, teacherId, date, startTime, endTime, room, eventType || 'class', req.user.id);

  const teacher = db.prepare(`SELECT user_id FROM teachers WHERE id = ?`).get(teacherId);
  if (teacher) {
    notifyUser({
      userId: teacher.user_id,
      title: `New ${eventType || 'class'} request from ${cr.batch} Sec ${cr.section}`,
      body: `${date} ${startTime}-${endTime} @ Room ${room}. Approve by 11:59 PM the night before, or it auto-cancels.`,
      type: 'class_request'
    });
  }

  res.status(201).json({ message: 'Request sent to the selected teacher for approval.', id: info.lastInsertRowid });
});

// B. Create extra class — with room-availability check first (dated bookings
// AND the fixed routine for that day-of-week; own-batch fixed slots don't
// count as a conflict, another batch's fixed slot does).
router.post('/extra-class', (req, res) => {
  const cr = getSelf(req);
  const { batch, section, courseId, teacherId, date, startTime, endTime, room } = req.body;
  if (!batch || !section || !courseId || !teacherId || !date || !startTime || !endTime || !room) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!isWithinClassHours(startTime, endTime)) {
    return res.status(400).json({ error: 'Class time must be between 8:00 AM and 5:00 PM, and start before it ends.' });
  }

  const conflictMsg = roomConflictMessage(room, date, startTime, endTime, batch);
  if (conflictMsg) return res.status(409).json({ error: conflictMsg });

  const info = db.prepare(`
    INSERT INTO class_events (batch, section, course_id, teacher_id, date, start_time, end_time, room, event_type, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'extra', 'pending', ?)
  `).run(batch, section, courseId, teacherId, date, startTime, endTime, room, req.user.id);

  const teacher = db.prepare(`SELECT user_id FROM teachers WHERE id = ?`).get(teacherId);
  if (teacher) {
    notifyUser({
      userId: teacher.user_id,
      title: `New extra class request from ${batch} Sec ${section}`,
      body: `${date} ${startTime}-${endTime} @ Room ${room}. Approve by 11:59 PM the night before, or it auto-cancels.`,
      type: 'class_request'
    });
  }

  res.status(201).json({ message: 'Extra class request sent to teacher for approval.', id: info.lastInsertRowid });
});

// C. View status of this CR's own requests (approved/rejected/pending)
router.get('/class-events', (req, res) => {
  const cr = getSelf(req);
  const rows = db.prepare(`
    SELECT e.*, c.code course_code, c.title course_title, t.name teacher_name
    FROM class_events e LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN teachers t ON t.id = e.teacher_id
    WHERE e.created_by = ? AND e.batch = ? AND e.section = ?
    ORDER BY e.date DESC, e.start_time DESC
  `).all(req.user.id, cr.batch, cr.section);
  res.json(rows);
});

// F. CR -> own batch group / other groups / teacher messaging (with optional PDF)
router.post('/messages', upload.single('file'), (req, res) => {
  const cr = getSelf(req);
  const { targetType, targetBatch, targetSection, targetTeacherId, content } = req.body;
  if (!targetType) return res.status(400).json({ error: 'targetType is required.' });

  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(`
    INSERT INTO messages (sender_id, sender_role, sender_name, target_type, target_batch, target_section, target_user_id, content, file_path)
    VALUES (?, 'cr', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, cr.full_name, targetType,
    targetType === 'teacher' ? null : (targetBatch || cr.batch),
    targetType === 'teacher' ? null : (targetSection || null),
    targetType === 'teacher' ? targetTeacherId : null,
    content || '', filePath
  );

  if (targetType === 'teacher' && targetTeacherId) {
    notifyUser({
      userId: targetTeacherId,
      title: `New message from ${cr.full_name} (${cr.batch} Sec ${cr.section})`,
      body: content || (filePath ? 'Sent an attachment.' : ''),
      type: 'cr_message'
    });
  }

  res.status(201).json({ message: 'Message sent.' });
});

// D. CR -> Students (notice board post, with optional PDF).
// Can target the CR's own batch, or a specific other batch chosen by the CR.
router.post('/notices', upload.single('file'), (req, res) => {
  const cr = getSelf(req);
  const { title, description, sectionOnly, scope, targetBatch } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  let noticeBatch = cr.batch;
  let noticeSection = sectionOnly === 'true' ? cr.section : null;

  if (scope === 'other') {
    if (!targetBatch) return res.status(400).json({ error: 'Please choose a target batch.' });
    noticeBatch = targetBatch;
    noticeSection = null; // CR isn't part of that batch, so it can't be section-scoped
  }

  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(`
    INSERT INTO notices (source, title, description, batch, section, file_path, created_by)
    VALUES ('cr', ?, ?, ?, ?, ?, ?)
  `).run(title, description || '', noticeBatch, noticeSection, filePath, req.user.id);

  notifyStudents({ batch: noticeBatch, section: noticeSection, title: `CR Notice: ${title}`, body: description || '', type: 'cr_notice' });

  res.status(201).json({ message: `Notice posted to ${noticeBatch}.` });
});

// CR's own notice history (own batch + any other batches they've posted to)
router.get('/notices', (req, res) => {
  const rows = db.prepare(`SELECT * FROM notices WHERE source = 'cr' AND created_by = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(rows);
});

// Inbox: messages this CR has received directly from any teacher —
// includes both teacher-initiated messages and replies within a thread
// the CR started (target_type = 'cr', target_user_id = this CR's user id).
router.get('/messages/inbox', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM messages WHERE target_type = 'cr' AND target_user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// E. Conversation thread with a teacher (view + the teacher's replies)
router.get('/messages/with-teacher/:teacherUserId', (req, res) => {
  const cr = getSelf(req);
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND target_user_id = ?) OR (sender_id = ? AND target_user_id = ?)
    ORDER BY created_at ASC
  `).all(req.user.id, req.params.teacherUserId, req.params.teacherUserId, req.user.id);
  res.json(rows);
});

// F. Create Poll
router.post('/polls', (req, res) => {
  const cr = getSelf(req);
  const { question, options, scope } = req.body; // scope: 'section' | 'batch'
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'A question and at least two options are required.' });
  }
  const info = db.prepare(`
    INSERT INTO polls (batch, section, question, status, created_by) VALUES (?, ?, ?, 'open', ?)
  `).run(cr.batch, scope === 'batch' ? null : cr.section, question, req.user.id);

  const insertOpt = db.prepare(`INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)`);
  options.forEach(opt => insertOpt.run(info.lastInsertRowid, opt));

  res.status(201).json({ message: 'Poll created.', id: info.lastInsertRowid });
});

// G. Materials — the CR chooses who sees a drive link: their own batch, a
// specific other batch, or every batch (department-wide). Students filter
// automatically on their end (GET /api/students/materials matches their own
// batch, plus anything marked 'ALL').
router.get('/materials', (req, res) => {
  // Shows every material this CR has personally added, regardless of which
  // batch it targets, so they can manage/remove their own posts.
  const materials = db.prepare(`SELECT * FROM materials WHERE created_by = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(materials);
});

router.post('/materials', (req, res) => {
  const cr = getSelf(req);
  const { title, link, scope, targetBatch } = req.body; // scope: 'own' | 'all' | 'other'
  if (!title || !link) return res.status(400).json({ error: 'Title and link are required.' });

  let materialBatch = cr.batch;
  if (scope === 'all') {
    materialBatch = 'ALL';
  } else if (scope === 'other') {
    if (!targetBatch) return res.status(400).json({ error: 'Please choose a target batch.' });
    materialBatch = targetBatch;
  }

  db.prepare(`INSERT INTO materials (batch, title, link, created_by) VALUES (?, ?, ?, ?)`)
    .run(materialBatch, title, link, req.user.id);
  res.status(201).json({ message: materialBatch === 'ALL' ? 'Material added for all batches.' : `Material added for ${materialBatch}.` });
});

router.delete('/materials/:id', (req, res) => {
  const material = db.prepare(`SELECT * FROM materials WHERE id = ? AND created_by = ?`).get(req.params.id, req.user.id);
  if (!material) return res.status(404).json({ error: 'Material not found.' });
  db.prepare(`DELETE FROM materials WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Material removed.' });
});

router.post('/polls/:id/close', (req, res) => {
  const cr = getSelf(req);
  const poll = db.prepare(`SELECT * FROM polls WHERE id = ? AND created_by = ?`).get(req.params.id, req.user.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found.' });
  db.prepare(`UPDATE polls SET status = 'closed' WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Poll closed.' });
});

module.exports = router;
