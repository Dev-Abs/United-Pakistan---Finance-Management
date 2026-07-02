function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token === (process.env.SESSION_SECRET || 'secret-token')) {
    return next();
  } else {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

module.exports = requireAuth;
