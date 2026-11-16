import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { loadContent, assetInfo, dbReady, getPageCache, setPageCache } from '../utils/siteContent.js';
import { renderPage } from '../utils/render.js';

const INDEX_FILE = fileURLToPath(new URL('../public/index.html', import.meta.url));
let template = null;

// Serves the home page with content filled in from the database.
// If the database is down or rendering fails, it calls next() so the plain
// index.html (with its built-in default content) is served instead.
export async function homeHandler(req, res, next) {
  try {
    if (!dbReady()) return next();

    let html = getPageCache();
    if (!html) {
      template ??= await fs.readFile(INDEX_FILE, 'utf8');
      const [content, assets] = await Promise.all([loadContent(), assetInfo()]);
      html = renderPage(template, content, assets);
      setPageCache(html);
    }

    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).send(html);
  } catch (error) {
    console.error('Home render failed, serving static page:', error.message);
    next();
  }
}
