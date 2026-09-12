require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/db');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const crRoutes = require('./routes/cr');
const teacherRoutes = require('./routes/teacher');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/cr', crRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve the production React frontend from the same server.
// This makes the app work on a single public URL after deployment.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Catch-all 403 for anyone probing for an /admin-style route without a valid admin token.
// (The real enforcement lives in requireRole() on every router above — this is just a friendly default.)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  if (require('fs').existsSync(path.join(frontendDist, 'index.html'))) {
    return res.sendFile(path.join(frontendDist, 'index.html'));
  }
  return res.status(404).json({ error: 'Frontend build not found. Run npm run build in frontend.' });
});

// ---- Auto-cancellation job ----
// "If a CR creates a class/exam for the next day and the teacher hasn't approved it
// by 11:59pm that night, the request is automatically cancelled."
// In practice this means: once an event's date has arrived and it is still 'pending',
// the approval window has closed.
function autoCancelExpiredRequests() {
  const today = new Date().toISOString().slice(0, 10);
  const result = db.prepare(`
    UPDATE class_events SET status = 'auto_cancelled'
    WHERE status = 'pending' AND date <= ?
  `).run(today);
  if (result.changes > 0) {
    console.log(`[auto-cancel] Cancelled ${result.changes} unapproved request(s) past their deadline.`);
  }
}
setInterval(autoCancelExpiredRequests, 5 * 60 * 1000); // check every 5 minutes
autoCancelExpiredRequests();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SUST CSE Coordination System API running on http://localhost:${PORT}`);
});
