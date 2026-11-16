import { Router } from 'express';
import { loadContent, getProjects } from '../utils/siteContent.js';
import { buildKnowledge } from '../utils/knowledge.js';
import { fullName } from '../utils/render.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const GROQ_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

// Groq retires models from time to time (llama-3.3-70b-versatile was shut down on
// 16 Aug 2026). Set GROQ_MODEL on Render to switch models without touching code.
// If the first model fails, the next one in this list is tried automatically.
const MODELS = [...new Set([process.env.GROQ_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'].filter(Boolean))];

// The assistant's knowledge is built from the live site content (edited in the admin
// dashboard), so it is never out of date with what visitors see on the page.
async function buildSystemPrompt() {
  const content = await loadContent();
  const projects = await getProjects();
  const name = fullName(content);
  const first = content.profile.firstName;

  return `You are an assistant embedded on ${name}'s ("${first}") personal portfolio website. You answer visitor questions ABOUT ${first} only — his skills, background, projects, experience, and how to contact him. Speak about him in the third person ("${first} is...", "He built..."), stay warm and professional, and keep answers short (2-4 sentences unless the visitor clearly wants more detail).

If a question is unrelated to ${first} (general knowledge, coding help for the visitor's own project, unrelated topics), politely say you're only able to answer questions about ${first}, and point them to the contact form for anything else.

Never invent facts about ${first} that aren't listed below. If you don't know something, say so honestly and suggest the contact form.

--- ABOUT ${name.toUpperCase()} ---
${buildKnowledge(content, projects)}
--- END ABOUT ${name.toUpperCase()} ---`;
}

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

router.post('/', rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many questions in a short time — please wait a few minutes.' }), async (req, res) => {
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
      { role: 'system', content: await buildSystemPrompt() },
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
