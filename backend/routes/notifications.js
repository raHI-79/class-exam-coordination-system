const express = require('express');
const db = require('../db/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// Returns whatever's relevant to the logged-in user:
// - students/CRs: direct notifications addressed to them, PLUS any broadcast
//   aimed at 'student' scoped to their own batch/section (or wider).
// - teachers: direct notifications addressed to them.
// - admin: direct notifications addressed to them (rarely used today).
router.get('/mine', (req, res) => {
  let rows;
  if (req.user.role === 'student' || req.user.role === 'cr') {
    const student = db.prepare(`SELECT * FROM students WHERE user_id = ?`).get(req.user.id);
    rows = db.prepare(`
      SELECT * FROM notifications
      WHERE recipient_user_id = ?
         OR (
              recipient_role = 'student'
              AND (recipient_batch IS NULL OR recipient_batch = ?)
              AND (recipient_section IS NULL OR recipient_section = ?)
            )
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id, student ? student.batch : '', student ? student.section : '');
  } else {
    rows = db.prepare(`
      SELECT * FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);
  }
  res.json(rows);
});

module.exports = router;
