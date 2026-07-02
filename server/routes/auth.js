const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    // Generate a simple token based on secret
    const token = process.env.SESSION_SECRET || 'secret-token';
    return res.json({ success: true, token });
  }

  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  res.json({ success: true });
});

router.get('/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token === (process.env.SESSION_SECRET || 'secret-token')) {
    return res.json({ success: true, authenticated: true });
  }
  return res.json({ success: true, authenticated: false });
});

module.exports = router;
