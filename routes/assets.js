import { Router } from 'express';
import Asset from '../models/Asset.js';
import { dbReady } from '../utils/siteContent.js';

const router = Router();

// GET /api/asset/photo | /api/asset/cv — files uploaded from the admin dashboard
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!['photo', 'cv'].includes(key) || !dbReady()) return res.status(404).end();

    const asset = await Asset.findOne({ key });
    if (!asset) return res.status(404).end();

    res.set({
      'Content-Type': asset.contentType,
      'Content-Length': String(asset.data.length),
      // Page URLs carry ?v=<timestamp>, so a new upload is picked up immediately.
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    });
    if (key === 'cv') {
      res.set('Content-Disposition', `inline; filename="${asset.filename || 'CV.pdf'}"`);
    }
    res.send(asset.data);
  } catch (error) {
    console.error('Asset error:', error.message);
    res.status(500).end();
  }
});

export default router;
