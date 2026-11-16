import { fullName } from './render.js';

const plain = (s) => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1');
const host = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
};

// Turns the live site content into the facts block the AI assistant answers from.
// Because it is built from the database, editing the site in the dashboard also
// updates what the assistant knows — nothing to keep in sync by hand.
export function buildKnowledge(content, projects) {
  const { profile, about, skills, experience, services, contact, site } = content;
  const out = [];

  out.push(`Name: ${fullName(content)}`);
  if (profile.eyebrow) out.push(`Headline: ${profile.eyebrow}`);
  if (profile.lede) out.push(`Summary: ${profile.lede}`);
  if (about.paragraphs.length) out.push(`About:\n${about.paragraphs.map((p) => `- ${plain(p)}`).join('\n')}`);
  if (about.stats.length) out.push(`Key numbers: ${about.stats.map((s) => `${s.value} ${s.label}`).join('; ')}`);

  if (skills.dev.length) out.push(`Development skills: ${skills.dev.map((s) => s.name).join(', ')}`);
  if (skills.office.length) out.push(`Office & productivity skills: ${skills.office.map((s) => s.name).join('; ')}`);
  if (skills.also.length) out.push(`Also working with: ${skills.also.join(', ')}`);

  if (experience.length) {
    out.push(`Experience & education:\n${experience.map((e) => `- ${e.date}: ${e.title}. ${e.description}`).join('\n')}`);
  }

  if (projects.length) {
    out.push(
      `Projects:\n${projects
        .map((p, i) => {
          const where = p.liveUrl ? ` (${host(p.liveUrl) || p.liveUrl})` : '';
          const tools = p.tools?.length ? ` Tools: ${p.tools.join(', ')}.` : '';
          return `${i + 1}. ${p.title}${where} — ${p.description}${tools}`;
        })
        .join('\n')}`
    );
  }

  if (services.length) out.push(`Services offered:\n${services.map((s) => `- ${s.title}: ${s.description}`).join('\n')}`);
  if (contact.lede) out.push(`Location & availability: ${contact.lede}`);
  if (contact.links.length) out.push(`Contact: ${contact.links.map((l) => `${l.label} ${l.url}`).join(' | ')}`);
  if (site.aiNotes) out.push(`Extra notes from ${profile.firstName}:\n${site.aiNotes}`);

  return out.join('\n\n');
}
