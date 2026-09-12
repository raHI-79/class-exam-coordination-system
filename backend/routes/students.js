const express = require('express');
const db = require('../db/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getSelf(req) {
  return db.prepare(`SELECT * FROM students WHERE user_id = ?`).get(req.user.id);
}

// All routes below require an authenticated student (or CR, since a CR is also a student)
router.use(verifyToken, requireRole('student', 'cr'));

// A. Profile
router.get('/me', (req, res) => {
  const student = getSelf(req);
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });
  res.json(student);
});

// A. Tomorrow's class & exam routine (own batch/section, merged fixed routine + approved dated events)
router.get('/routine/tomorrow', (req, res) => {
  const student = getSelf(req);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  const dayName = DAYS[tomorrow.getDay()];

  const fixed = db.prepare(`
    SELECT r.*, c.code course_code, c.title course_title, t.name teacher_name
    FROM routines r
    LEFT JOIN courses c ON c.id = r.course_id
    LEFT JOIN teachers t ON t.id = r.teacher_id
    WHERE r.batch = ? AND r.section = ? AND r.day_of_week = ?
    ORDER BY r.start_time
  `).all(student.batch, student.section, dayName);

  const events = db.prepare(`
    SELECT e.*, c.code course_code, c.title course_title, t.name teacher_name
    FROM class_events e
    LEFT JOIN courses c ON c.id = e.course_id
    LEFT JOIN teachers t ON t.id = e.teacher_id
    WHERE e.batch = ? AND e.section = ? AND e.date = ? AND e.status = 'approved'
    ORDER BY e.start_time
  `).all(student.batch, student.section, dateStr);

  res.json({ date: dateStr, day: dayName, fixedClasses: fixed, scheduledEvents: events });
});

// B. Drop course routine — junior batch routine for the dropped course + own batch routine
router.get('/routine/drop-course', (req, res) => {
  const student = getSelf(req);
  if (!student.has_drop_course || !student.drop_course_code) {
    return res.json({ hasDropCourse: false, ownBatchRoutine: [], dropCourseRoutine: [] });
  }
  const course = db.prepare(`SELECT * FROM courses WHERE code = ?`).get(student.drop_course_code);

  const ownBatchRoutine = db.prepare(`
    SELECT r.*, c.code course_code, c.title course_title, t.name teacher_name
    FROM routines r LEFT JOIN courses c ON c.id = r.course_id LEFT JOIN teachers t ON t.id = r.teacher_id
    WHERE r.batch = ? AND r.section = ?
    ORDER BY r.day_of_week, r.start_time
  `).all(student.batch, student.section);

  let dropCourseRoutine = [];
  if (course) {
    dropCourseRoutine = db.prepare(`
      SELECT r.*, c.code course_code, c.title course_title, t.name teacher_name
      FROM routines r LEFT JOIN courses c ON c.id = r.course_id LEFT JOIN teachers t ON t.id = r.teacher_id
      WHERE r.course_id = ? AND r.batch != ?
      ORDER BY r.batch, r.day_of_week, r.start_time
    `).all(course.id, student.batch);
  }

  res.json({ hasDropCourse: true, dropCourseCode: student.drop_course_code, ownBatchRoutine, dropCourseRoutine });
});

// C. Upcoming exam / assignment schedule (approved 'exam' events, own batch/section, from today onward)
router.get('/exams/upcoming', (req, res) => {
  const student = getSelf(req);
  const today = new Date().toISOString().slice(0, 10);
  const exams = db.prepare(`
    SELECT e.*, c.code course_code, c.title course_title
    FROM class_events e LEFT JOIN courses c ON c.id = e.course_id
    WHERE e.batch = ? AND e.section = ? AND e.event_type = 'exam' AND e.status = 'approved' AND e.date >= ?
    ORDER BY e.date, e.start_time
  `).all(student.batch, student.section, today);
  res.json(exams);
});

// D. Full fixed semester routine — filterable by batch, section, day, course.
// Defaults to the student's own batch/section, but any batch/section can be
// browsed (e.g. to check another section's or another batch's routine).
router.get('/routine/semester', (req, res) => {
  const student = getSelf(req);
  const { day, batch, section, course } = req.query;
  let sql = `
    SELECT r.*, c.code course_code, c.title course_title, t.name teacher_name
    FROM routines r LEFT JOIN courses c ON c.id = r.course_id LEFT JOIN teachers t ON t.id = r.teacher_id
    WHERE r.batch = ?
  `;
  const params = [batch || student.batch];
  sql += ` AND r.section = ?`; params.push(section || student.section);
  if (day) { sql += ` AND r.day_of_week = ?`; params.push(day); }
  if (course) { sql += ` AND c.code = ?`; params.push(course); }
  sql += ` ORDER BY r.day_of_week, r.start_time`;
  res.json(db.prepare(sql).all(...params));
});

// Lookups to populate the Batch / Section dropdowns for browsing fixed routines
router.get('/routine/lookups/batches', (req, res) => {
  const rows = db.prepare(`SELECT DISTINCT batch FROM routines ORDER BY batch`).all();
  res.json(rows.map(r => r.batch));
});
router.get('/routine/lookups/sections', (req, res) => {
  const { batch } = req.query;
  if (!batch) return res.status(400).json({ error: 'batch query param is required.' });
  const rows = db.prepare(`SELECT DISTINCT section FROM routines WHERE batch = ? ORDER BY section`).all(batch);
  res.json(rows.map(r => r.section));
});

// E. CR notices — a CR can post to their own batch or a specific other
// batch. Every CR notice is returned here (batch/section included on each
// row) so the student UI can offer an "own batch" / "other batch" filter.
router.get('/notices/cr', (req, res) => {
  const student = getSelf(req);
  const notices = db.prepare(`
    SELECT * FROM notices WHERE source = 'cr' AND (section IS NULL OR section = ? OR batch != ?)
    ORDER BY created_at DESC
  `).all(student.section, student.batch);
  res.json(notices);
});

router.get('/notices/admin', (req, res) => {
  const notices = db.prepare(`SELECT * FROM notices WHERE source = 'admin' ORDER BY created_at DESC`).all();
  res.json(notices);
});

// G. Materials (drive links). Each material targets the CR's own batch, a
// specific other batch, or 'ALL' (every batch) — a student only sees links
// aimed at their own batch, plus anything marked for all batches.
router.get('/materials', (req, res) => {
  const student = getSelf(req);
  const materials = db.prepare(`
    SELECT * FROM materials WHERE batch = ? OR batch = 'ALL' ORDER BY created_at DESC
  `).all(student.batch);
  res.json(materials);
});

// H. All batch students directory
router.get('/directory', (req, res) => {
  const students = db.prepare(`
    SELECT s.full_name, s.reg_no, s.batch, s.section, s.phone, s.email, s.blood_group, s.is_cr
    FROM students s JOIN users u ON u.id = s.user_id
    WHERE u.status = 'active'
    ORDER BY s.batch, s.section, s.full_name
  `).all();
  res.json(students);
});

// Teacher directory — name/phone/email, straight from what Administration
// entered when adding each teacher.
router.get('/teachers-info', (req, res) => {
  const teachers = db.prepare(`
    SELECT t.name, t.teacher_id, t.email, t.phone
    FROM teachers t JOIN users u ON u.id = t.user_id
    WHERE u.status = 'active'
    ORDER BY t.name
  `).all();
  res.json(teachers);
});

// Inbox: any message addressed to this student personally, plus any
// batch/section broadcast (from a CR or a teacher) that matches their own
// batch/section.
router.get('/messages', (req, res) => {
  const student = getSelf(req);
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE (target_type = 'student' AND target_user_id = ?)
       OR (
            target_type IN ('batch_group', 'student_broadcast')
            AND target_batch = ?
            AND (target_section IS NULL OR target_section = ?)
          )
    ORDER BY created_at DESC
  `).all(req.user.id, student.batch, student.section);
  res.json(rows);
});

// I. Polls — list polls relevant to student's batch/section + whether they've voted
router.get('/polls', (req, res) => {
  const student = getSelf(req);
  const polls = db.prepare(`
    SELECT * FROM polls WHERE (batch = ? OR batch IS NULL) AND (section = ? OR section IS NULL)
    ORDER BY created_at DESC
  `).all(student.batch, student.section);

  const result = polls.map(p => {
    const options = db.prepare(`
      SELECT o.*, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) as vote_count
      FROM poll_options o WHERE o.poll_id = ?
    `).all(p.id);
    const myVote = db.prepare(`SELECT option_id FROM poll_votes WHERE poll_id = ? AND student_id = ?`).get(p.id, student.id);
    return { ...p, options, myVoteOptionId: myVote ? myVote.option_id : null };
  });
  res.json(result);
});

router.post('/polls/:id/vote', (req, res) => {
  const student = getSelf(req);
  const pollId = req.params.id;
  const { optionId } = req.body;

  const poll = db.prepare(`SELECT * FROM polls WHERE id = ?`).get(pollId);
  if (!poll) return res.status(404).json({ error: 'Poll not found.' });
  if (poll.status !== 'open') return res.status(400).json({ error: 'This poll is closed.' });

  const existing = db.prepare(`SELECT id FROM poll_votes WHERE poll_id = ? AND student_id = ?`).get(pollId, student.id);
  if (existing) return res.status(409).json({ error: 'You have already voted in this poll.' });

  try {
    db.prepare(`INSERT INTO poll_votes (poll_id, option_id, student_id) VALUES (?, ?, ?)`).run(pollId, optionId, student.id);
    res.json({ message: 'Vote recorded.' });
  } catch (e) {
    res.status(400).json({ error: 'Could not record vote.' });
  }
});

module.exports = router;
