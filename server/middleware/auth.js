function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  const adminSecret = process.env.SESSION_SECRET || 'secret-token';
  const readerSecret = process.env.READER_SECRET || 'reader-secret-token';

  if (token === adminSecret) {
    req.userRole = 'admin';
    return next();
  }

  if (token === readerSecret) {
    req.userRole = 'reader';
    return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

function requireWriteAccess(req, res, next) {
  if (req.userRole === 'reader') {
    return res.status(403).json({ success: false, error: 'Read-only access. You do not have permission to modify data.' });
  }
  next();
}

module.exports = { requireAuth, requireWriteAccess };
