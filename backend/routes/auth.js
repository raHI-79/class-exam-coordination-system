const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, identifier: user.identifier }, JWT_SECRET, { expiresIn: '12h' });
}

// ---------- STUDENT SELF-REGISTRATION ----------
// New students go in as status='pending' and must be approved by Administration
// before they can log in. (See requirements section 5-D.)
router.post('/register', (req, res) => {
  const {
    fullName, regNo, batch, section, email, phone, bloodGroup,
    password, confirmPassword, hasDropCourse, dropCourseCode
  } = req.body;

  if (!fullName || !regNo || !batch || !section || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE identifier = ?`).get(regNo);
  if (existing) {
    return res.status(409).json({ error: 'A student with this Registration Number already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const insertUser = db.prepare(
    `INSERT INTO users (role, identifier, password_hash, status) VALUES ('student', ?, ?, 'pending')`
  );
  const userInfo = insertUser.run(regNo, hash);

  db.prepare(`
    INSERT INTO students (user_id, full_name, reg_no, batch, section, email, phone, blood_group, has_drop_course, drop_course_code, is_cr)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    userInfo.lastInsertRowid, fullName, regNo, batch, section, email, phone || '', bloodGroup || '',
    hasDropCourse ? 1 : 0, hasDropCourse ? (dropCourseCode || null) : null
  );

  res.status(201).json({
    message: 'Registration submitted. Your account is pending approval from Administration before you can log in.'
  });
});

// ---------- UNIFIED LOGIN for student / CR / teacher ----------
// identifier = Registration Number (student/CR) or Teacher ID (teacher)
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifier and password are required.' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE identifier = ? AND role IN ('student','cr','teacher')`).get(identifier);
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Your account is still pending approval from Administration.' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Your registration was not approved. Please contact Administration.' });
  }
  if (user.status === 'removed') {
    return res.status(403).json({ error: 'This account has been deactivated. Please contact Administration.' });
  }

  let profile = null;
  if (user.role === 'teacher') {
    profile = db.prepare(`SELECT * FROM teachers WHERE user_id = ?`).get(user.id);
  } else {
    profile = db.prepare(`SELECT * FROM students WHERE user_id = ?`).get(user.id);
    // A student flagged is_cr=1 actually logs in with role 'cr' privileges
  }

  // The JWT must carry the EFFECTIVE role (cr vs student), since every
  // protected route checks req.user.role from the token, not the raw DB role.
  const effectiveRole = (user.role === 'student' && profile && profile.is_cr) ? 'cr' : user.role;
  const token = sign({ ...user, role: effectiveRole });

  res.json({ token, role: effectiveRole, profile });
});

// ---------- ADMIN LOGIN (separate, not discoverable from student/CR/teacher UI) ----------
router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  const user = db.prepare(`SELECT * FROM users WHERE identifier = ? AND role = 'admin'`).get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  const token = sign(user);
  res.json({ token, role: 'admin' });
});

// ---------- FORGOT / RESET PASSWORD ----------
router.post('/forgot-password', (req, res) => {
  const { identifier } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE identifier = ?`).get(identifier);
  if (!user) {
    // Do not reveal whether the account exists
    return res.json({ message: 'If an account with that identifier exists, a reset token has been generated.' });
  }
  const token = crypto.randomBytes(20).toString('hex');
  db.prepare(`UPDATE users SET reset_token = ? WHERE id = ?`).run(token, user.id);

  // NOTE: In production this token would be emailed/SMS'd to the user.
  // For this self-hosted demo we return it directly so the reset flow is testable end-to-end.
  res.json({ message: 'Reset token generated.', resetToken: token });
});

router.post('/reset-password', (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'Reset token and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const user = db.prepare(`SELECT * FROM users WHERE reset_token = ?`).get(resetToken);
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset token.' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL WHERE id = ?`).run(hash, user.id);
  res.json({ message: 'Password has been reset. You can now log in.' });
});

module.exports = router;
