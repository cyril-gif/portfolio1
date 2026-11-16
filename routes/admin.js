import { Router } from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Project from '../models/Project.js';
import Asset from '../models/Asset.js';
import { login, logout, requireAdmin } from '../middleware/adminAuth.js';
import {
  loadContent,
  saveSection,
  getProjects,
  assetInfo,
  invalidate,
  dbReady,
  lastEdited,
  ensureSeed
} from '../utils/siteContent.js';
import { sections, project as sanitizeProject, ValidationError, str } from '../utils/validate.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isId = (id) => mongoose.isObjectIdOrHexString(id);

// Nothing from the admin API should ever be cached or sniffed.
router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  next();
});

// Every change must come from the dashboard's own script (custom header). A page on
// another site cannot add this header without our permission, on top of SameSite cookies.
const requireXhr = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'admin') {
    return res.status(403).json({ success: false, error: 'Request blocked.' });
  }
  next();
};

const requireDb = (req, res, next) =>
  dbReady() ? next() : res.status(503).json({ success: false, error: 'The database is not connected.' });

// ---- auth -------------------------------------------------------------------
router.post('/login', wrap(login));
router.post('/logout', requireXhr, logout);
router.get('/me', requireAdmin, (req, res) => res.json({ success: true, email: req.admin.email }));

// everything below needs a valid session
router.use(requireAdmin, requireXhr, requireDb);

// ---- shapes sent to the dashboard ------------------------------------------
const toMessage = (m) => ({
  id: String(m._id),
  name: m.name,
  email: m.email,
  subject: m.subject,
  message: m.message,
  read: !!m.read,
  createdAt: m.createdAt
});

const toProject = (p) => ({
  id: String(p._id),
  title: p.title,
  category: p.category,
  description: p.description,
  tools: p.tools || [],
  liveUrl: p.liveUrl || '',
  codeUrl: p.codeUrl || '',
  visible: p.visible !== false,
  order: p.order ?? 0
});

const toFile = (f) =>
  f ? { exists: true, filename: f.filename, contentType: f.contentType, size: f.size, updatedAt: f.updatedAt } : { exists: false };

// tiny endpoint the dashboard polls for the unread badge
router.get(
  '/unread',
  wrap(async (req, res) => {
    res.json({ success: true, count: await Message.countDocuments({ read: false }) });
  })
);

// ---- overview ---------------------------------------------------------------
router.get(
  '/overview',
  wrap(async (req, res) => {
    const [total, unread, recent, projectsTotal, projectsVisible, edited, files] = await Promise.all([
      Message.countDocuments(),
      Message.countDocuments({ read: false }),
      Message.find().sort({ createdAt: -1 }).limit(5).lean(),
      Project.countDocuments(),
      Project.countDocuments({ visible: true }),
      lastEdited(),
      assetInfo()
    ]);

    res.json({
      success: true,
      messages: { total, unread, recent: recent.map(toMessage) },
      projects: { total: projectsTotal, visible: projectsVisible },
      lastEdited: edited,
      files: { photo: toFile(files.photo), cv: toFile(files.cv) },
      status: {
        database: true,
        ai: !!process.env.GROQ_API_KEY,
        aiModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        email: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
      }
    });
  })
);

// ---- site content -----------------------------------------------------------
router.get(
  '/content',
  wrap(async (req, res) => {
    const [content, files] = await Promise.all([loadContent(), assetInfo()]);
    res.json({ success: true, content, files: { photo: toFile(files.photo), cv: toFile(files.cv) } });
  })
);

router.put(
  '/content/:section',
  wrap(async (req, res) => {
    const sanitize = sections[req.params.section];
    if (!sanitize) return res.status(404).json({ success: false, error: 'Unknown section.' });
    const clean = sanitize(req.body);
    await saveSection(req.params.section, clean);
    res.json({ success: true, data: clean });
  })
);

// ---- projects ---------------------------------------------------------------
router.get(
  '/projects',
  wrap(async (req, res) => {
    await ensureSeed();
    const rows = await getProjects({ includeHidden: true });
    res.json({ success: true, data: rows.map(toProject) });
  })
);

router.post(
  '/projects',
  wrap(async (req, res) => {
    const data = sanitizeProject(req.body);
    const last = await Project.findOne().sort({ order: -1 }).lean();
    const doc = await Project.create({ ...data, order: (last?.order ?? -1) + 1 });
    invalidate();
    res.status(201).json({ success: true, data: toProject(doc) });
  })
);

// must be declared before "/projects/:id"
router.put(
  '/projects/reorder',
  wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length > 200 || !ids.every(isId)) {
      throw new ValidationError('Invalid project order.');
    }
    await Project.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } })));
    invalidate();
    res.json({ success: true });
  })
);

router.put(
  '/projects/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) throw new ValidationError('Invalid project.');
    const data = sanitizeProject(req.body);
    const doc = await Project.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!doc) return res.status(404).json({ success: false, error: 'Project not found.' });
    invalidate();
    res.json({ success: true, data: toProject(doc) });
  })
);

router.delete(
  '/projects/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) throw new ValidationError('Invalid project.');
    const doc = await Project.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Project not found.' });
    invalidate();
    res.json({ success: true });
  })
);

// ---- messages ---------------------------------------------------------------
const PAGE_SIZE = 20;

router.get(
  '/messages',
  wrap(async (req, res) => {
    const filter = req.query.filter === 'unread' ? { read: false } : {};
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [items, total, unread] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Message.countDocuments(filter),
      Message.countDocuments({ read: false })
    ]);
    res.json({ success: true, items: items.map(toMessage), total, unread, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  })
);

// must be declared before "/messages/:id"
router.post(
  '/messages/read-all',
  wrap(async (req, res) => {
    const result = await Message.updateMany({ read: false }, { $set: { read: true } });
    res.json({ success: true, updated: result.modifiedCount ?? 0 });
  })
);

router.patch(
  '/messages/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) throw new ValidationError('Invalid message.');
    if (typeof req.body?.read !== 'boolean') throw new ValidationError('Invalid request.');
    const doc = await Message.findByIdAndUpdate(req.params.id, { $set: { read: req.body.read } }, { new: true });
    if (!doc) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true, data: toMessage(doc) });
  })
);

router.delete(
  '/messages/:id',
  wrap(async (req, res) => {
    if (!isId(req.params.id)) throw new ValidationError('Invalid message.');
    const doc = await Message.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true });
  })
);

// ---- files (profile photo, CV) ---------------------------------------------
const FILE_RULES = {
  photo: { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 1.5 * 1024 * 1024, label: 'Photo' },
  cv: { types: ['application/pdf'], maxBytes: 3 * 1024 * 1024, label: 'CV' }
};

// Check the real file contents, not just what the browser claims it is.
function looksLike(type, b) {
  switch (type) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'application/pdf':
      return b.subarray(0, 5).toString('latin1') === '%PDF-';
    default:
      return false;
  }
}

function parseDataUrl(s) {
  if (typeof s !== 'string' || !s.startsWith('data:')) return null;
  const i = s.indexOf(';base64,');
  if (i < 0) return null;
  const type = s.slice(5, i).toLowerCase();
  if (!/^[a-z]+\/[a-z0-9.+-]+$/.test(type)) return null;
  return { type, b64: s.slice(i + 8) };
}

router.get(
  '/files',
  wrap(async (req, res) => {
    const files = await assetInfo();
    res.json({ success: true, files: { photo: toFile(files.photo), cv: toFile(files.cv) } });
  })
);

router.put(
  '/files/:key',
  wrap(async (req, res) => {
    const rule = FILE_RULES[req.params.key];
    if (!rule) return res.status(404).json({ success: false, error: 'Unknown file.' });

    const parsed = parseDataUrl(req.body?.dataUrl);
    if (!parsed) throw new ValidationError('Choose a file to upload.');
    if (!rule.types.includes(parsed.type)) {
      throw new ValidationError(`${rule.label} must be ${rule.types.map((t) => t.split('/')[1].toUpperCase()).join(', ')}.`);
    }

    const buffer = Buffer.from(parsed.b64, 'base64');
    if (!buffer.length) throw new ValidationError('That file is empty.');
    if (buffer.length > rule.maxBytes) {
      throw new ValidationError(`${rule.label} is too large (max ${(rule.maxBytes / 1024 / 1024).toFixed(1)} MB).`);
    }
    if (!looksLike(parsed.type, buffer)) throw new ValidationError(`That file is not a real ${rule.label.toLowerCase()}.`);

    const filename = str(req.body?.filename, 120, 'File name').replace(/[^\w. -]/g, '_') || (req.params.key === 'cv' ? 'CV.pdf' : 'photo');
    const doc = await Asset.findOneAndUpdate(
      { key: req.params.key },
      { $set: { contentType: parsed.type, filename, size: buffer.length, data: buffer } },
      { upsert: true, new: true, setDefaultsOnInsert: false }
    );
    invalidate();
    res.json({ success: true, file: toFile(doc) });
  })
);

router.delete(
  '/files/:key',
  wrap(async (req, res) => {
    if (!FILE_RULES[req.params.key]) return res.status(404).json({ success: false, error: 'Unknown file.' });
    await Asset.deleteOne({ key: req.params.key });
    invalidate();
    res.json({ success: true });
  })
);

// ---- errors -----------------------------------------------------------------
router.use((err, req, res, next) => {
  if (err instanceof ValidationError || err?.name === 'ValidationError' || err?.name === 'CastError') {
    return res.status(400).json({ success: false, error: err instanceof ValidationError ? err.message : 'Some of that information is invalid.' });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'That upload is too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: 'Invalid request.' });
  console.error('Admin API error:', err);
  res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
});

export default router;
