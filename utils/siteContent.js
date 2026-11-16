import mongoose from 'mongoose';
import SiteContent from '../models/SiteContent.js';
import Project from '../models/Project.js';
import Asset from '../models/Asset.js';
import { defaultContent, defaultProjects } from '../data/defaultContent.js';

const TTL_MS = 30_000;
let contentCache = null;
let contentCachedAt = 0;
let pageCache = null; // { html, at } — rendered home page, managed by routes/home.js
const PAGE_TTL_MS = 5 * 60_000;

export const dbReady = () => mongoose.connection.readyState === 1;

// Called after every admin change so visitors see edits immediately.
export function invalidate() {
  contentCache = null;
  pageCache = null;
}
export const getPageCache = () => (pageCache && Date.now() - pageCache.at < PAGE_TTL_MS ? pageCache.html : null);
export const setPageCache = (html) => {
  pageCache = { html, at: Date.now() };
};

// Stored values win; anything missing falls back to the shipped default.
// This also means new fields added in future updates just work.
function mergeSection(def, stored) {
  if (Array.isArray(def)) return Array.isArray(stored) ? stored : def;
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) return { ...def, ...stored };
  return def;
}

export async function loadContent() {
  if (!dbReady()) return structuredClone(defaultContent);
  if (contentCache && Date.now() - contentCachedAt < TTL_MS) return contentCache;

  const doc = await SiteContent.findOne({ key: 'main' }).lean();
  const stored = doc?.data || {};
  const merged = {};
  for (const [name, def] of Object.entries(defaultContent)) merged[name] = mergeSection(def, stored[name]);

  contentCache = merged;
  contentCachedAt = Date.now();
  return merged;
}

export async function saveSection(name, value) {
  await SiteContent.updateOne(
    { key: 'main' },
    { $set: { [`data.${name}`]: value } },
    { upsert: true, setDefaultsOnInsert: false }
  );
  invalidate();
}

export async function lastEdited() {
  const doc = await SiteContent.findOne({ key: 'main' }, 'updatedAt').lean();
  return doc?.updatedAt || null;
}

// ---- projects ---------------------------------------------------------------

export async function getProjects({ includeHidden = false } = {}) {
  if (!dbReady()) return defaultProjects.map((p, i) => ({ ...p, _id: String(i + 1), visible: true, order: i }));

  const doc = await SiteContent.findOne({ key: 'main' }, 'projectsSeeded').lean();
  const filter = includeHidden ? {} : { visible: true };
  const rows = await Project.find(filter).sort({ order: 1, createdAt: 1 }).lean();

  // Never seeded and nothing stored yet (e.g. very first request): show defaults.
  if (!rows.length && !doc?.projectsSeeded) {
    return defaultProjects.map((p, i) => ({ ...p, _id: String(i + 1), visible: true, order: i }));
  }
  return rows;
}

// ---- first-run seeding ------------------------------------------------------

export async function ensureSeed() {
  const doc = await SiteContent.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { data: structuredClone(defaultContent), projectsSeeded: false } },
    { upsert: true, new: true, setDefaultsOnInsert: false }
  );

  if (!doc.projectsSeeded) {
    const existing = await Project.countDocuments();
    if (existing === 0) {
      await Project.insertMany(defaultProjects.map((p, i) => ({ ...p, visible: true, order: i })));
    }
    await SiteContent.updateOne({ key: 'main' }, { $set: { projectsSeeded: true } });
    console.log('🌱 Seeded default projects');
  }
}

// ---- uploaded files ---------------------------------------------------------

export async function assetInfo() {
  if (!dbReady()) return {};
  const rows = await Asset.find({}, 'key contentType filename size updatedAt').lean();
  return Object.fromEntries(rows.map((r) => [r.key, r]));
}
