function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
}

module.exports = requireAuth;
