// The content that ships with the site. On first boot it is copied into MongoDB;
// after that, the admin dashboard edits the database copy. If the database is
// ever unreachable, the site falls back to these values instead of breaking.

export const defaultContent = {
  profile: {
    firstName: 'Pascal',
    lastName: 'Lantam Gbate',
    eyebrow: 'Full-Stack Developer — Founder, PascalLinks',
    headlineLead: 'I build',
    headlineEm: 'the software and write the paperwork that makes a business run.',
    tags: 'Frontend · Backend · Mobile · AI',
    lede:
      'Full-stack web & mobile developer, AI integration consultant, business support specialist, and mentor. ' +
      'I ship products with Node.js, Express and MongoDB, build mobile apps with Flutter, help businesses put AI ' +
      'to work in their operations, handle the reports and decks that go around it all, and teach beginners how ' +
      'to do the same.',
    meta: 'Wa, Ghana → Remote · Web · Mobile · AI · 6 products shipped'
  },

  about: {
    paragraphs: [
      "I'm a full-stack developer and founder based in Wa, Ghana, building for businesses across Ghana and beyond. " +
        'I build web platforms with Node.js, Express and MongoDB, mobile apps with Flutter, and I help businesses ' +
        'put AI to work in their day-to-day operations.',
      'I founded **PascalLinks**, a live digital services platform, and **StoreLinks**, a multi-vendor e-commerce ' +
        'marketplace — both built to solve real problems for real users, not just to look good on a résumé.',
      'Outside of code, I handle the side of the work most developers skip: formatting a clean report in Word, ' +
        'building a dashboard in Excel that a non-technical manager can actually read, or putting together a pitch ' +
        'deck that gets a founder through an investor meeting. I also mentor people who are just starting out — ' +
        'walking beginners through web development, Excel, PowerPoint and Word until they can build things on their ' +
        'own, not just follow along.',
      'That combination — able to build the product, present it, and teach someone else to do it — is what I bring ' +
        'to a team.'
    ],
    stats: [
      { value: '6', label: 'Products shipped' },
      { value: '2', label: 'Products founded' },
      { value: '2+', label: 'Years building web apps' }
    ]
  },

  skills: {
    dev: [
      { name: 'HTML5 & CSS3', level: 92 },
      { name: 'JavaScript (ES6+)', level: 88 },
      { name: 'Node.js & Express', level: 85 },
      { name: 'MongoDB & Mongoose', level: 82 },
      { name: 'REST APIs & JWT Auth', level: 80 },
      { name: 'Git & version control', level: 83 },
      { name: 'Mobile apps with Flutter', level: 70 },
      { name: 'Business AI integration', level: 75 }
    ],
    office: [
      { icon: 'W', name: 'Microsoft Word — reports, templates, mail merge', level: 90 },
      { icon: 'X', name: 'Microsoft Excel — formulas, pivot tables, dashboards', level: 87 },
      { icon: 'P', name: 'Microsoft PowerPoint — pitch decks, data storytelling', level: 85 }
    ],
    also: ['Python', 'MySQL', 'PHP', 'WordPress']
  },

  experience: [
    {
      date: '2026 — Present',
      title: 'Industrial Attachment — Noni Hub, Wa',
      description:
        'Facilitating web development training for students, contributing to project development, and supporting platform builds for community learning initiatives.'
    },
    {
      date: '2024 — Present',
      title: 'Founder — PascalLinks',
      description:
        'Built and maintain a live digital services platform, handling everything from backend architecture to client delivery.'
    },
    {
      date: '2024 — Present',
      title: 'Founder — StoreLinks',
      description:
        'Designed and built a multi-vendor e-commerce marketplace with vendor accounts, product listings and order handling.'
    },
    {
      date: '2023 — Present',
      title: 'B.Sc. Computer Science — UBIDS, Wa',
      description:
        'Level 300 student, coursework spanning systems analysis, backend development, and applied programming.'
    }
  ],

  services: [
    {
      mark: '</>',
      title: 'Website development',
      description:
        'Custom websites and web apps built with HTML, CSS, JavaScript, and a Node/Express/MongoDB backend when you need one.'
    },
    {
      mark: 'W',
      title: 'Document & report formatting',
      description:
        'Clean, professional Word documents — reports, proposals, templates — formatted the way a client expects to receive them.'
    },
    {
      mark: 'X',
      title: 'Data analysis & dashboards',
      description:
        'Excel dashboards and spreadsheets that turn raw numbers into something a manager can actually use to make decisions.'
    },
    {
      mark: 'P',
      title: 'Presentation design',
      description:
        'Pitch decks and slide presentations built for clarity — the kind that hold up in front of investors or a board.'
    },
    {
      mark: '▣',
      title: 'Mobile app development',
      description:
        "Cross-platform mobile apps built with Flutter, matched to a business's actual workflow, not a generic template."
    },
    {
      mark: 'AI',
      title: 'AI integration for businesses',
      description:
        'Helping businesses put AI to work in real operations — customer support, content, automation — without the hype.'
    },
    {
      mark: 'M',
      title: 'Mentorship & training',
      description:
        'One-on-one and group coaching in web development, Excel, PowerPoint and Word — for beginners who want to build real things, not just watch tutorials.'
    }
  ],

  contact: {
    lede:
      'Based in Wa, Upper West Region, Ghana. Open to junior developer roles, IT/business-support work, and freelance projects.',
    links: [
      { label: 'GitHub', url: 'https://github.com/cyril-gif' },
      { label: 'WhatsApp', url: 'https://wa.me/233595046967' },
      { label: 'Email', url: 'mailto:cyrillantam@gmail.com' }
    ]
  },

  site: {
    seoTitle: 'Pascal Lantam Gbate — Full-Stack Developer & Business Support Specialist',
    seoDescription:
      'Portfolio of Pascal Lantam Gbate — full-stack web & mobile developer, AI integration consultant, and business support specialist based in Wa, Ghana. HTML, CSS, JavaScript, Node.js, Express, MongoDB, Flutter, plus Word, Excel and PowerPoint.',
    shareDescription:
      'Full-stack web & mobile developer, AI integration consultant, and business support specialist based in Wa, Ghana. Node.js, Express, MongoDB, Flutter, plus Word, Excel and PowerPoint.',
    ticker: [
      'HTML5', 'CSS3', 'JavaScript', 'Node.js', 'Express', 'MongoDB', 'MySQL', 'PHP',
      'Flutter', 'Python', 'AI Integration', 'WordPress', 'Word', 'Excel', 'PowerPoint'
    ],
    footerNote: 'Wa, Ghana — working remotely',
    aiNotes: ''
  }
};

export const defaultProjects = [
  {
    title: 'PascalLinks',
    category: 'development',
    description: 'A live digital services platform connecting clients to web, design, and business-support services.',
    tools: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    liveUrl: 'https://pascallinks.com',
    codeUrl: ''
  },
  {
    title: 'StoreLinks',
    category: 'development',
    description: 'A multi-vendor e-commerce marketplace with vendor dashboards, product listings, and order management.',
    tools: ['Node.js', 'Express', 'MongoDB', 'Mongoose'],
    liveUrl: 'https://store.pascallinks.com',
    codeUrl: ''
  },
  {
    title: 'Pascal AI',
    category: 'development',
    description:
      'A full-stack AI chat app built for Ghanaian users, with streaming responses, image/file uploads, web search, and offline support as a PWA.',
    tools: ['Next.js', 'Express', 'MongoDB', 'Groq'],
    liveUrl: 'https://pascal-ai.vercel.app',
    codeUrl: ''
  },
  {
    title: 'DevForge',
    category: 'development',
    description:
      'A gamified web development learning platform, Sololearn-style, with structured lessons and progress tracking.',
    tools: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    liveUrl: 'https://devforge-tech.vercel.app',
    codeUrl: ''
  },
  {
    title: "Wilder's Corner",
    category: 'development',
    description:
      'An e-commerce store for shoes, bags, jewellery, belts and hair products, with categories, flash sales, discounts, cart and account management.',
    tools: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    liveUrl: 'https://wilders-corner.vercel.app',
    codeUrl: ''
  },
  {
    title: 'AncestorData',
    category: 'development',
    description:
      'A platform for buying MTN, Telecel and AirtelTigo data bundles instantly via Mobile Money, plus a BECE results checker — no account required.',
    tools: ['JavaScript', 'Node.js', 'MongoDB', 'Mobile Money API'],
    liveUrl: 'https://ancestor-data.vercel.app',
    codeUrl: ''
  },
  {
    title: 'Client Sales Dashboard',
    category: 'office',
    description:
      'An Excel dashboard built for a small retail client to track weekly sales, top products, and margins using pivot tables and dynamic charts.',
    tools: ['Excel', 'Pivot Tables', 'Data Analysis'],
    liveUrl: '',
    codeUrl: ''
  },
  {
    title: 'Funding Pitch Deck',
    category: 'office',
    description:
      'A 12-slide investor pitch deck designed for a startup founder — clean data storytelling built for a five-minute pitch.',
    tools: ['PowerPoint', 'Presentation Design'],
    liveUrl: '',
    codeUrl: ''
  }
];
