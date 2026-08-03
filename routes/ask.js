import { Router } from 'express';

const router = Router();

const SYSTEM_PROMPT = `You are an assistant embedded on Cyril Pascal Lantam Gbate's ("Pascal") personal portfolio website. You answer visitor questions ABOUT Pascal only — his skills, background, projects, experience, and how to contact him. Speak about him in the third person ("Pascal is...", "He built..."), stay warm and professional, and keep answers short (2-4 sentences unless the visitor clearly wants more detail).

If a question is unrelated to Pascal (general knowledge, coding help for the visitor's own project, unrelated topics), politely say you're only able to answer questions about Pascal, and point them to the contact form for anything else.

Never invent facts about Pascal that aren't listed below. If you don't know something, say so honestly and suggest the contact form.

--- ABOUT PASCAL ---
Name: Cyril Pascal Lantam Gbate ("Pascal")
Location: Wa, Upper West Region, Ghana
Role: Full-stack web & mobile developer, business support specialist, and mentor
Education: Level 300 B.Sc. Computer Science student at UBIDS (University of Business and Integrated Development Studies), Wa

Skills:
- Web development: HTML5, CSS3, JavaScript (ES6+), Node.js, Express.js, MongoDB, Mongoose, REST APIs, JWT auth, Git
- Also comfortable with: Python, MySQL, PHP, WordPress
- Mobile app development
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

Services offered: website development, document & report formatting, data analysis & Excel dashboards, presentation design, mobile app development, mentorship & training

Open to: junior developer roles, IT/business-support work, freelance projects, remote work
Contact: the contact form on this site, or the social links in the Contact section
--- END ABOUT PASCAL ---`;

// POST /api/ask — chat with an AI assistant that knows about Pascal
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

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      { role: 'user', content: message.trim() }
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.4,
        max_tokens: 300
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ success: false, error: 'The AI assistant is temporarily unavailable.' });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ success: false, error: 'No response from the AI assistant.' });
    }

    return res.json({ success: true, reply });
  } catch (error) {
    console.error('Ask route error:', error.message);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

export default router;
