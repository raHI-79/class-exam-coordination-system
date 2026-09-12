const db = require('./db');

// Broadcasts a notification to every student in a batch/section scope.
// batch=null means "all batches"; section=null (with a batch set) means
// "everyone in that batch, regardless of section".
function notifyStudents({ batch = null, section = null, title, body = '', type = 'notice' }) {
  db.prepare(`
    INSERT INTO notifications (recipient_role, recipient_batch, recipient_section, type, title, body)
    VALUES ('student', ?, ?, ?, ?, ?)
  `).run(batch, section, type, title, body);
}

// Sends a notification to exactly one user (a specific CR, teacher, or student).
function notifyUser({ userId, title, body = '', type = 'general' }) {
  db.prepare(`
    INSERT INTO notifications (recipient_user_id, type, title, body)
    VALUES (?, ?, ?, ?)
  `).run(userId, type, title, body);
}

module.exports = { notifyStudents, notifyUser };
