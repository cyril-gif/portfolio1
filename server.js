import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import contactRoutes from './routes/contact.js';
import projectRoutes from './routes/projects.js';
import askRoutes from './routes/ask.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/contact', contactRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ask', askRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Fallback to index.html for any non-API route (simple SPA-friendly routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Server error. Please try again.' });
});

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI not set — the contact form will fail until you add it to .env');
    } else {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB connected');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
