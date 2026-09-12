const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sust-cse-dev-secret-change-in-production';

function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. No token provided.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role, identifier }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
}

// Backend-enforced RBAC — this is the real gate, not just hiding UI buttons.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '403 Access Denied / Unauthorized Access' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };
