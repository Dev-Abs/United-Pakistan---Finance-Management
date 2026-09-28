require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public, non-sensitive deployment probe. This confirms the Express function is
// running and reports only whether required integrations were configured.
app.get('/api/health', (req, res) => {
  const configured = Boolean(
    process.env.JWT_SECRET &&
    process.env.DATABASE_URL
  );

  res.status(configured ? 200 : 503).json({
    success: configured,
    service: 'united-pakistan-finance',
    configured,
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/team', require('./routes/team'));
app.use('/api/members', require('./routes/members'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/months', require('./routes/months'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/special-fund', require('./routes/special-fund'));
app.use('/api/export', require('./routes/export'));
app.use('/api/diagnostics', require('./routes/diagnostics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ai', require('./routes/ai'));

// Fingerprinted/versioned app assets can be cached; HTML stays fresh so a
// deployment cannot strand clients on an old shell with new modules.
app.use(express.static(path.join(__dirname, '../public'), {
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }
  }
}));

// Fallback to index.html for SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// For local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel serverless functions
module.exports = app;
