import 'dotenv/config'; // must be first so every module below can read .env values
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import contactRoutes from './routes/contact.js';
import projectRoutes from './routes/projects.js';
import askRoutes from './routes/ask.js';
import assetRoutes from './routes/assets.js';
import adminRoutes from './routes/admin.js';
import { homeHandler } from './routes/home.js';
import { ensureSeed } from './utils/siteContent.js';
import { adminConfig } from './middleware/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
const PORT = process.env.PORT || 5000;

// Render sits behind a proxy: needed for real visitor IPs (rate limits) and https detection.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors());

// Locked-down headers for the dashboard pages: scripts may only come from this site,
// the page can't be framed, and search engines are told to stay away.
app.use('/admin', (req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store'
  });
  next();
});

// The admin API gets its own (larger) body limit for photo/CV uploads, and is mounted
// BEFORE the normal 100 KB parser so only the dashboard can send big requests.
app.use('/api/admin', express.json({ limit: '6mb' }), adminRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home page: rendered from the database (falls back to the plain file if needed).
app.get(['/', '/index.html'], homeHandler);

// Static files (css, js, images, /admin/ dashboard)
app.use(express.static(PUBLIC_DIR));

// Public API
app.use('/api/contact', contactRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ask', askRoutes);
app.use('/api/asset', assetRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Unknown API paths get a JSON 404 (not the home page)
app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Not found.' }));

// Any other path serves the site
app.get('*', homeHandler, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'Request too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: 'Invalid request.' });
  console.error(err?.stack || err);
  res.status(500).json({ success: false, error: 'Server error. Please try again.' });
});

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI not set — contact form, admin dashboard and editable content are unavailable.');
    } else {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB connected');
      try {
        await ensureSeed();
      } catch (error) {
        console.error('⚠️  Could not seed default content:', error.message);
      }
    }

    const admin = adminConfig();
    if (admin.enabled) console.log('🔐 Admin dashboard enabled at /admin');
    else console.warn(`⚠️  Admin dashboard is OFF: ${admin.problems.join('; ')}`);

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
