const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Admin login
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = process.env.SESSION_SECRET || 'secret-token';
    return res.json({ success: true, token, role: 'admin', username: process.env.ADMIN_USERNAME });
  }

  // Read-only user login
  const readerUsername = process.env.READER_USERNAME || 'user';
  const readerPassword = process.env.READER_PASSWORD || 'user';
  if (
    username === readerUsername &&
    password === readerPassword
  ) {
    const token = process.env.READER_SECRET || 'reader-secret-token';
    return res.json({ success: true, token, role: 'reader', username: readerUsername });
  }

  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  res.json({ success: true });
});

router.get('/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  const adminSecret = process.env.SESSION_SECRET || 'secret-token';
  const readerSecret = process.env.READER_SECRET || 'reader-secret-token';

  if (token === adminSecret) {
    return res.json({ success: true, authenticated: true, role: 'admin' });
  }
  if (token === readerSecret) {
    return res.json({ success: true, authenticated: true, role: 'reader' });
  }
  return res.json({ success: true, authenticated: false });
});

module.exports = router;
