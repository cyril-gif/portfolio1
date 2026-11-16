// Server-side rendering of the editable parts of public/index.html.
//
// index.html contains marker comments like <!--region:about--> ... <!--/region:about-->.
// Whatever sits between a pair of markers is replaced with fresh HTML built from the
// database. The markers stay in place so the page can be re-rendered on every change.
// If anything goes wrong, the plain index.html (with its built-in default content)
// is served instead, so the site never breaks.

export const escText = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const escAttr = (s) => escText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Text with **bold** support (used in About paragraphs). Escaped first, so it is safe.
export const inline = (s) => escText(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const version = (asset) => (asset?.updatedAt ? new Date(asset.updatedAt).getTime() : 0);
const pct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const dots = '<span class="dot dot--1"></span><span class="dot dot--2"></span><span class="dot dot--3"></span>';

export const fullName = (c) => `${c.profile.firstName} ${c.profile.lastName}`.trim();

const regions = {
  seo(c) {
    const s = c.site;
    return `
<title>${escText(s.seoTitle)}</title>
<meta name="description" content="${escAttr(s.seoDescription)}" />
<meta property="og:title" content="${escAttr(s.seoTitle)}" />
<meta property="og:description" content="${escAttr(s.shareDescription)}" />
<meta name="twitter:title" content="${escAttr(s.seoTitle)}" />
<meta name="twitter:description" content="${escAttr(s.shareDescription)}" />
`;
  },

  brandName(c) {
    return escText(fullName(c));
  },

  hero(c, assets) {
    const p = c.profile;
    const cv = assets.cv ? `/api/asset/cv?v=${version(assets.cv)}` : '/cv.pdf';
    return `
${p.eyebrow ? `<p class="hero__eyebrow">${escText(p.eyebrow)}</p>` : ''}
<h1 class="hero__name">${escText(p.firstName)} <em>${escText(p.lastName)}</em></h1>
${p.headlineLead || p.headlineEm ? `<p class="hero__build">${escText(p.headlineLead)} <em>${escText(p.headlineEm)}</em></p>` : ''}
${p.tags ? `<p class="hero__tags">${escText(p.tags)}</p>` : ''}
${p.lede ? `<p class="hero__lede">${escText(p.lede)}</p>` : ''}
<div class="hero__actions">
  <a href="#projects" class="btn btn--primary">View the work</a>
  <a href="${cv}" class="btn btn--ghost" download>Download CV</a>
  <a href="#contact" class="btn btn--text">Get in touch →</a>
</div>
${p.meta ? `<p class="hero__meta">${escText(p.meta)}</p>` : ''}
`;
  },

  ticker(c) {
    const group = `<div class="ticker__group">${c.site.ticker.map((t) => `<span>${escText(t)}</span>`).join('')}</div>`;
    return `\n${group}\n${group}\n`;
  },

  about(c, assets) {
    const a = c.about;
    const photo = assets.photo ? `/api/asset/photo?v=${version(assets.photo)}` : '/images/pass.png';
    const stats = a.stats.length
      ? `<div class="about__stats">${a.stats
          .map(
            (s) =>
              `<div class="stat"><span class="stat__num">${escText(s.value)}</span><span class="stat__label">${escText(s.label)}</span></div>`
          )
          .join('')}</div>`
      : '';
    return `
<div class="about__photo">
  <img src="${escAttr(photo)}" alt="${escAttr(fullName(c))}" />
</div>
<div class="about__body">
  ${a.paragraphs.map((p) => `<p>${inline(p)}</p>`).join('\n  ')}
  ${stats}
</div>
`;
  },

  skills(c) {
    const s = c.skills;
    const dev = s.dev.length
      ? `<div class="skillpane skillpane--dev">
  <div class="skillpane__bar">${dots}<span class="skillpane__title">~/development</span></div>
  <div class="skillpane__body"><ul class="skilllist">${s.dev
    .map(
      (i) =>
        `<li class="skillitem"><span class="skillitem__prompt">&gt;</span><span class="skillitem__name">${escText(i.name)}</span><span class="bar"><span class="bar__fill" style="width:${pct(i.level)}%"></span></span></li>`
    )
    .join('')}</ul></div>
</div>`
      : '';
    const office = s.office.length
      ? `<div class="skillpane skillpane--office">
  <div class="skillpane__bar skillpane__bar--office"><span class="skillpane__title">Office &amp; Productivity</span></div>
  <div class="skillpane__body"><ul class="skilllist">${s.office
    .map(
      (i) =>
        `<li class="skillitem"><span class="skillitem__icon">${escText(i.icon)}</span><span class="skillitem__name">${escText(i.name)}</span><span class="bar"><span class="bar__fill" style="width:${pct(i.level)}%"></span></span></li>`
    )
    .join('')}</ul></div>
</div>`
      : '';
    const also = s.also.length
      ? `<div class="skillpane skillpane--extra">
  <div class="skillpane__bar">${dots}<span class="skillpane__title">~/also-working-with</span></div>
  <div class="skillpane__body"><div class="tagcloud">${s.also.map((t) => `<span class="tagchip">${escText(t)}</span>`).join('')}</div></div>
</div>`
      : '';
    return `\n${dev}\n${office}\n${also}\n`;
  },

  experience(c) {
    return (
      '\n' +
      c.experience
        .map(
          (e) => `<li class="timeline__item">
  <span class="timeline__date">${escText(e.date)}</span>
  <h3 class="timeline__title">${escText(e.title)}</h3>
  <p class="timeline__desc">${escText(e.description)}</p>
</li>`
        )
        .join('\n') +
      '\n'
    );
  },

  services(c) {
    return (
      '\n' +
      c.services
        .map(
          (s) => `<div class="service">
  <span class="service__mark">${escText(s.mark)}</span>
  <h3>${escText(s.title)}</h3>
  <p>${escText(s.description)}</p>
</div>`
        )
        .join('\n') +
      '\n'
    );
  },

  contact(c) {
    const ct = c.contact;
    const links = ct.links
      .map((l) => {
        const external = /^https?:\/\//i.test(l.url);
        return `<li><a href="${escAttr(l.url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escText(l.label)}</a></li>`;
      })
      .join('\n  ');
    return `
<p class="contact-side__lede">${escText(ct.lede)}</p>
<ul class="social-list">
  ${links}
</ul>
`;
  },

  footer(c) {
    return `
<p>© <span id="year"></span> ${escText(fullName(c))}</p>
<p>${escText(c.site.footerNote)}</p>
<ul class="footer__links">
  <li><a href="#hero">Top</a></li>
  <li><a href="#projects">Work</a></li>
  <li><a href="#contact">Contact</a></li>
</ul>
`;
  }
};

export const REGION_NAMES = Object.keys(regions);

export function renderPage(template, content, assets = {}) {
  let html = template;
  for (const name of REGION_NAMES) {
    const re = new RegExp(`(<!--region:${name}-->)[\\s\\S]*?(<!--/region:${name}-->)`);
    if (!re.test(html)) continue;
    const inner = regions[name](content, assets);
    // function replacer so "$" characters in content are never treated as patterns
    html = html.replace(re, (_, open, close) => `${open}${inner}${close}`);
  }
  return html;
}
