import { Router } from 'express';

const router = Router();

const projects = [
  {
    id: 1,
    title: 'PascalLinks',
    category: 'development',
    description: 'A live digital services platform connecting clients to web, design, and business-support services.',
    tools: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    liveUrl: 'https://pascallinks.com',
    codeUrl: '#'
  },
  {
    id: 2,
    title: 'StoreLinks',
    category: 'development',
    description: 'A multi-vendor e-commerce marketplace with vendor dashboards, product listings, and order management.',
    tools: ['Node.js', 'Express', 'MongoDB', 'Mongoose'],
    liveUrl: 'https://store.pascallinks.com',
    codeUrl: '#'
  },
  {
    id: 3,
    title: 'Pascal AI',
    category: 'development',
    description: 'A full-stack AI chat app built for Ghanaian users, with streaming responses, image/file uploads, web search, and offline support as a PWA.',
    tools: ['Next.js', 'Express', 'MongoDB', 'Groq'],
    liveUrl: 'https://pascal-ai.vercel.app',
    codeUrl: '#'
  },
  {
    id: 4,
    title: 'DevForge',
    category: 'development',
    description: 'A gamified web development learning platform, Sololearn-style, with structured lessons and progress tracking.',
    tools: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    liveUrl: 'https://devforge-tech.vercel.app',
    codeUrl: '#'
  },
  {
    id: 5,
    title: "Wilder's Corner",
    category: 'development',
    description: 'An e-commerce store for shoes, bags, jewellery, belts and hair products, with categories, flash sales, discounts, cart and account management.',
    tools: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    liveUrl: 'https://wilders-corner.vercel.app',
    codeUrl: '#'
  },
  {
    id: 6,
    title: 'AncestorData',
    category: 'development',
    description: "A platform for buying MTN, Telecel and AirtelTigo data bundles instantly via Mobile Money, plus a BECE results checker — no account required.",
    tools: ['JavaScript', 'Node.js', 'MongoDB', 'Mobile Money API'],
    liveUrl: 'https://ancestor-data.vercel.app',
    codeUrl: '#'
  },
  {
    id: 7,
    title: 'Client Sales Dashboard',
    category: 'office',
    description: 'An Excel dashboard built for a small retail client to track weekly sales, top products, and margins using pivot tables and dynamic charts.',
    tools: ['Excel', 'Pivot Tables', 'Data Analysis'],
    liveUrl: '#',
    codeUrl: '#'
  },
  {
    id: 8,
    title: 'Funding Pitch Deck',
    category: 'office',
    description: 'A 12-slide investor pitch deck designed for a startup founder — clean data storytelling built for a five-minute pitch.',
    tools: ['PowerPoint', 'Presentation Design'],
    liveUrl: '#',
    codeUrl: '#'
  }
];

// GET /api/projects
router.get('/', (req, res) => {
  const { category } = req.query;
  const filtered = category ? projects.filter((p) => p.category === category) : projects;
  res.json({ success: true, count: filtered.length, data: filtered });
});

export default router;
