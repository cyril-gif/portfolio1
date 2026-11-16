// Everything the admin dashboard saves passes through here first.
// Errors are thrown as ValidationError (HTTP 400) with a message that is safe
// to show directly in the dashboard.

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

// Strip control characters, normalise line endings, trim.
const clean = (v) =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

export function str(v, max, label, { required = false, multiline = false } = {}) {
  if (v !== undefined && v !== null && typeof v !== 'string' && typeof v !== 'number') {
    throw new ValidationError(`${label} must be text.`);
  }
  let s = clean(v);
  if (!multiline) s = s.replace(/\s*\n\s*/g, ' ');
  if (required && !s) throw new ValidationError(`${label} is required.`);
  if (s.length > max) throw new ValidationError(`${label} is too long (max ${max} characters).`);
  return s;
}

export function arr(v, max, label, { min = 0 } = {}) {
  if (!Array.isArray(v)) throw new ValidationError(`${label} must be a list.`);
  if (v.length > max) throw new ValidationError(`${label}: at most ${max} items allowed.`);
  if (v.length < min) throw new ValidationError(`${label}: add at least ${min}.`);
  return v;
}

export function obj(v, label) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ValidationError(`${label} is invalid.`);
  return v;
}

export function level(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ValidationError(`${label} must be a number from 0 to 100.`);
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function bool(v) {
  return v === true || v === 'true' || v === 1;
}

// Only web links, email and phone links are allowed — never javascript:, data:, etc.
// "#" and empty mean "no link". A bare "github.com/x" is upgraded to https.
export function url(v, label, { allowMail = false } = {}) {
  const s = str(v, 300, label);
  if (!s || s === '#') return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new Error('host');
      return u.toString();
    } catch {
      throw new ValidationError(`${label} is not a valid web address.`);
    }
  }
  if (allowMail && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s)) return s;
  if (allowMail && /^tel:\+?[0-9()\-\s]{5,25}$/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    throw new ValidationError(`${label}: only https:// links${allowMail ? ', mailto: and tel:' : ''} are allowed.`);
  }
  if (/^[^\s/]+\.[^\s/]+/.test(s)) return url(`https://${s}`, label, { allowMail });
  throw new ValidationError(`${label} is not a valid web address.`);
}

// Comma- or newline-separated text → clean list (used for tags / ticker).
export function tagList(v, maxItems, maxLen, label) {
  const raw = Array.isArray(v) ? v : String(v ?? '').split(/[,\n]/);
  const out = [];
  for (const item of raw) {
    const s = str(item, maxLen, label);
    if (s && !out.includes(s)) out.push(s);
  }
  if (out.length > maxItems) throw new ValidationError(`${label}: at most ${maxItems} items allowed.`);
  return out;
}

// ---- section sanitizers -----------------------------------------------------
// Each takes untrusted input and returns a clean object, or throws ValidationError.

export const sections = {
  profile(d) {
    obj(d, 'Profile');
    return {
      firstName: str(d.firstName, 40, 'First name', { required: true }),
      lastName: str(d.lastName, 60, 'Last name', { required: true }),
      eyebrow: str(d.eyebrow, 120, 'Role line'),
      headlineLead: str(d.headlineLead, 40, 'Headline start'),
      headlineEm: str(d.headlineEm, 200, 'Headline (italic part)'),
      tags: str(d.tags, 120, 'Tag line'),
      lede: str(d.lede, 1200, 'Intro paragraph', { multiline: true }),
      meta: str(d.meta, 160, 'Small line under the buttons')
    };
  },

  about(d) {
    obj(d, 'About');
    const paragraphs = arr(d.paragraphs, 8, 'Paragraphs')
      .map((p, i) => str(p, 1500, `Paragraph ${i + 1}`, { multiline: true }))
      .filter(Boolean);
    if (!paragraphs.length) throw new ValidationError('Add at least one paragraph.');
    const stats = arr(d.stats ?? [], 4, 'Stats')
      .map((s, i) => {
        obj(s, `Stat ${i + 1}`);
        return { value: str(s.value, 12, `Stat ${i + 1} number`), label: str(s.label, 40, `Stat ${i + 1} label`) };
      })
      .filter((s) => s.value || s.label);
    return { paragraphs, stats };
  },

  skills(d) {
    obj(d, 'Skills');
    const dev = arr(d.dev ?? [], 20, 'Development skills')
      .map((s, i) => {
        obj(s, `Development skill ${i + 1}`);
        return {
          name: str(s.name, 60, `Development skill ${i + 1} name`),
          level: level(s.level, `Development skill ${i + 1} level`)
        };
      })
      .filter((s) => s.name);
    const office = arr(d.office ?? [], 12, 'Office skills')
      .map((s, i) => {
        obj(s, `Office skill ${i + 1}`);
        return {
          icon: str(s.icon, 2, `Office skill ${i + 1} icon`) || '•',
          name: str(s.name, 90, `Office skill ${i + 1} name`),
          level: level(s.level, `Office skill ${i + 1} level`)
        };
      })
      .filter((s) => s.name);
    return { dev, office, also: tagList(d.also ?? [], 24, 40, 'Also working with') };
  },

  experience(d) {
    return arr(d, 20, 'Experience')
      .map((e, i) => {
        obj(e, `Entry ${i + 1}`);
        return {
          date: str(e.date, 40, `Entry ${i + 1} date`),
          title: str(e.title, 120, `Entry ${i + 1} title`),
          description: str(e.description, 600, `Entry ${i + 1} description`, { multiline: true })
        };
      })
      .filter((e) => e.title);
  },

  services(d) {
    return arr(d, 12, 'Services')
      .map((s, i) => {
        obj(s, `Service ${i + 1}`);
        return {
          mark: str(s.mark, 4, `Service ${i + 1} icon`) || '•',
          title: str(s.title, 80, `Service ${i + 1} title`),
          description: str(s.description, 400, `Service ${i + 1} description`, { multiline: true })
        };
      })
      .filter((s) => s.title);
  },

  contact(d) {
    obj(d, 'Contact');
    const links = arr(d.links ?? [], 8, 'Links')
      .map((l, i) => {
        obj(l, `Link ${i + 1}`);
        return {
          label: str(l.label, 30, `Link ${i + 1} label`),
          url: url(l.url, `Link ${i + 1} address`, { allowMail: true })
        };
      })
      .filter((l) => l.label && l.url);
    return { lede: str(d.lede, 400, 'Contact text', { multiline: true }), links };
  },

  site(d) {
    obj(d, 'Site settings');
    return {
      seoTitle: str(d.seoTitle, 120, 'Page title', { required: true }),
      seoDescription: str(d.seoDescription, 300, 'Search description'),
      shareDescription: str(d.shareDescription, 300, 'Share preview description'),
      ticker: tagList(d.ticker ?? [], 30, 30, 'Scrolling strip'),
      footerNote: str(d.footerNote, 120, 'Footer line'),
      aiNotes: str(d.aiNotes, 2000, 'Extra notes for the AI assistant', { multiline: true })
    };
  }
};

export function project(d) {
  obj(d, 'Project');
  const category = d.category === 'office' ? 'office' : 'development';
  return {
    title: str(d.title, 80, 'Title', { required: true }),
    category,
    description: str(d.description, 500, 'Description', { multiline: true }),
    tools: tagList(d.tools ?? [], 10, 30, 'Tools'),
    liveUrl: url(d.liveUrl, 'Live site address'),
    codeUrl: url(d.codeUrl, 'Source code address'),
    visible: d.visible === undefined ? true : bool(d.visible)
  };
}
