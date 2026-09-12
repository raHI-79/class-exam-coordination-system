const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'sust_cse.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- SCHEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('student','cr','teacher','admin')),
  identifier TEXT NOT NULL UNIQUE, -- reg_no for student/cr, teacher_id for teacher, username for admin
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, pending, rejected, removed
  reset_token TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  reg_no TEXT NOT NULL UNIQUE,
  batch TEXT NOT NULL,
  section TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  blood_group TEXT,
  has_drop_course INTEGER DEFAULT 0,
  drop_course_code TEXT,
  is_cr INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  teacher_id TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL
);

-- Fixed semester routine (recurring weekly)
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch TEXT NOT NULL,
  section TEXT NOT NULL,
  course_id INTEGER REFERENCES courses(id),
  teacher_id INTEGER REFERENCES teachers(id),
  day_of_week TEXT NOT NULL, -- Sunday..Saturday
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT NOT NULL,
  type TEXT DEFAULT 'class' -- class, lab
);

-- Dated class/exam/extra-class events created by CR, approved by teacher
CREATE TABLE IF NOT EXISTS class_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch TEXT NOT NULL,
  section TEXT NOT NULL,
  course_id INTEGER REFERENCES courses(id),
  teacher_id INTEGER REFERENCES teachers(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'class', -- class, exam, extra
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled, auto_cancelled
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch TEXT,
  section TEXT,
  question TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open, closed
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id),
  UNIQUE(poll_id, student_id)
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, -- admin, cr
  title TEXT NOT NULL,
  description TEXT,
  batch TEXT,
  section TEXT,
  file_path TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch TEXT NOT NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  sender_name TEXT,
  target_type TEXT NOT NULL, -- 'batch_group', 'teacher', 'student_broadcast', 'cr'
  target_batch TEXT,
  target_section TEXT,
  target_user_id INTEGER, -- for direct teacher<->CR messages
  parent_id INTEGER REFERENCES messages(id), -- for replies
  content TEXT,
  file_path TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- In-app notifications. A notification is either addressed to one specific
-- user (recipient_user_id set), or broadcast to every student matching a
-- role/batch/section combination (recipient_batch/section NULL = everyone
-- in that scope). There's no per-user "read" tracking table — the frontend
-- tracks "last seen" locally, which is enough for a simple unread badge.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_user_id INTEGER REFERENCES users(id),
  recipient_role TEXT, -- 'student' for batch/section-scoped broadcasts
  recipient_batch TEXT,
  recipient_section TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ---------- SEED DATA (idempotent) ----------
function seed() {
  const adminExists = db.prepare(`SELECT id FROM users WHERE role='admin' LIMIT 1`).get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (role, identifier, password_hash, status) VALUES ('admin','admin',?,'active')`).run(hash);
    console.log('Seeded default admin -> username: admin / password: admin123 (CHANGE THIS)');
  }

  const courseCount = db.prepare(`SELECT COUNT(*) c FROM courses`).get().c;
  if (courseCount === 0) {
    const insert = db.prepare(`INSERT INTO courses (code, title) VALUES (?, ?)`);
    insert.run('CSE-231', 'Digital Logic Design (DLD)');
    insert.run('CSE-233', 'Theory of Computation (TOC)');
    insert.run('MAT-241', 'Laplace Transform & Fourier Analysis');
    insert.run('CSE-235', 'Web Engineering');
    insert.run('CSE-237', 'Numerical Methods');
  }
}
seed();

module.exports = db;
