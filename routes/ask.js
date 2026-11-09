import { Router } from 'express';

const router = Router();

const GROQ_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

// Groq retires models from time to time (llama-3.3-70b-versatile was shut down on
// 16 Aug 2026). Set GROQ_MODEL on Render to switch models without touching code.
// If the first model fails, the next one in this list is tried automatically.
const MODELS = [...new Set([process.env.GROQ_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'].filter(Boolean))];

const SYSTEM_PROMPT = `You are an assistant embedded on Pascal Lantam Gbate's ("Pascal") personal portfolio website. You answer visitor questions ABOUT Pascal only — his skills, background, projects, experience, and how to contact him. Speak about him in the third person ("Pascal is...", "He built..."), stay warm and professional, and keep answers short (2-4 sentences unless the visitor clearly wants more detail).

If a question is unrelated to Pascal (general knowledge, coding help for the visitor's own project, unrelated topics), politely say you're only able to answer questions about Pascal, and point them to the contact form for anything else.

Never invent facts about Pascal that aren't listed below. If you don't know something, say so honestly and suggest the contact form.

--- ABOUT PASCAL ---
Name: Pascal Lantam Gbate
Location: Wa, Upper West Region, Ghana
Role: Full-stack web & mobile developer, AI integration consultant, business support specialist, and mentor
Education: Level 300 B.Sc. Computer Science student at UBIDS (University of Business and Integrated Development Studies), Wa

Skills:
- Web development: HTML5, CSS3, JavaScript (ES6+), Node.js, Express.js, MongoDB, Mongoose, REST APIs, JWT auth, Git
- Also comfortable with: Python, MySQL, PHP, WordPress
- Mobile app development with Flutter
- AI integration for businesses — helping businesses put AI to work in real operations like customer support, content, and automation
- Office & productivity: Microsoft Word (reports, templates, mail merge), Excel (formulas, pivot tables, dashboards), PowerPoint (pitch decks, data storytelling)
- Mentors beginners in web development, Excel, PowerPoint and Word

Experience:
- Industrial Attachment at Noni Hub, Wa — facilitates web development training for students, contributes to project development
- Founder of PascalLinks (pascallinks.com) — a live digital services platform in Ghana
- Founder of StoreLinks (store.pascallinks.com) — a multi-vendor e-commerce marketplace

Live projects:
1. PascalLinks (pascallinks.com) — digital services platform
2. StoreLinks (store.pascallinks.com) — multi-vendor e-commerce marketplace
3. Pascal AI (pascal-ai.vercel.app) — full-stack AI chat app for Ghanaian users, streaming responses, file uploads, web search, PWA features
4. DevForge (devforge-tech.vercel.app) — gamified web development learning platform, Sololearn-style
5. Wilder's Corner (wilders-corner.vercel.app) — e-commerce store for shoes, bags, jewellery, belts and hair products
6. AncestorData (ancestor-data.vercel.app) — instant data bundle purchases (MTN, Telecel, AirtelTigo) via Mobile Money, plus a BECE results checker

Services offered: website development, document & report formatting, data analysis & Excel dashboards, presentation design, mobile app development with Flutter, AI integration for businesses, mentorship & training

Open to: junior developer roles, IT/business-support work, freelance projects, remote work
Contact: the contact form on this site, or the social links in the Contact section
--- END ABOUT PASCAL ---`;

// POST /api/ask — chat with an AI assistant that knows about Pascal
function buildRequest(model, messages) {
  const body = { model, messages, temperature: 0.4, max_completion_tokens: 1024 };

  // gpt-oss models are "reasoning" models. Keep the thinking short so replies are
  // fast, and hide it so only the answer comes back.
  if (model.startsWith('openai/gpt-oss')) {
    body.reasoning_effort = 'low';
    body.include_reasoning = false;
  }
  return body;
}

async function askGroq(messages) {
  for (const model of MODELS) {
    try {
      const groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify(buildRequest(model, messages)),
        signal: AbortSignal.timeout(25000)
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error(`Groq error [${model}] HTTP ${groqRes.status}:`, errText.slice(0, 500));
        // A bad or revoked key will fail for every model, so don't bother retrying.
        if (groqRes.status === 401 || groqRes.status === 403) return null;
        continue;
      }

      const data = await groqRes.json();
      const choice = data.choices?.[0];
      const reply = choice?.message?.content?.trim();
      if (reply) return reply;

      console.error(`Groq [${model}] returned an empty reply (finish_reason: ${choice?.finish_reason})`);
    } catch (error) {
      console.error(`Groq request failed [${model}]:`, error.message);
    }
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'A message is required.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'The AI assistant is not configured yet. Please use the contact form instead.'
      });
    }

    // Only accept plain user/assistant turns from the browser, so a visitor can't
    // slip in their own "system" instructions.
    const cleanHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...cleanHistory,
      { role: 'user', content: message.trim().slice(0, 500) }
    ];

    const reply = await askGroq(messages);

    if (!reply) {
      return res.status(502).json({
        success: false,
        error: 'The AI assistant is temporarily unavailable. Please use the contact form instead.'
      });
    }

    return res.json({ success: true, reply });
  } catch (error) {
    console.error('Ask route error:', error.message);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

export default router;
