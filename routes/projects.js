import { Router } from 'express';
import { getProjects } from '../utils/siteContent.js';

const router = Router();

// GET /api/projects — the projects shown on the public site (hidden ones excluded)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const rows = await getProjects();
    const data = rows
      .filter((p) => !category || p.category === category)
      .map((p) => ({
        id: String(p._id),
        title: p.title,
        category: p.category,
        description: p.description,
        tools: p.tools || [],
        liveUrl: p.liveUrl || '',
        codeUrl: p.codeUrl || ''
      }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Projects error:', error.message);
    res.status(500).json({ success: false, error: 'Could not load projects.' });
  }
});

export default router;
