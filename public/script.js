// ============================================================
// Backend API base URL
// Points directly at the Render backend so the site works whether
// the HTML is served from Render itself or from a separate host
// like Vercel (which can't run the Express server).
// ============================================================
const API_BASE = 'https://portfolio1-3yq0.onrender.com';

// ============================================================
// Footer year
// ============================================================
document.getElementById('year').textContent = new Date().getFullYear();

// ============================================================
// Mobile nav toggle
// ============================================================
const navToggle = document.getElementById('navToggle');
const tabNav = document.getElementById('tabNav');

navToggle.addEventListener('click', () => {
  const isOpen = tabNav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

tabNav.querySelectorAll('.tab').forEach((link) => {
  link.addEventListener('click', () => {
    tabNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ============================================================
// Active tab highlighting on scroll
// ============================================================
const tabs = document.querySelectorAll('.tab[data-section]');
const sections = Array.from(tabs)
  .map((tab) => document.getElementById(tab.dataset.section))
  .filter(Boolean);

const setActiveTab = (id) => {
  tabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.section === id);
  });
};

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveTab(entry.target.id);
    });
  },
  { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
);

sections.forEach((section) => sectionObserver.observe(section));

// ============================================================
// Scroll reveal animations
// ============================================================
const revealTargets = document.querySelectorAll(
  '.section__head, .about__grid, .skillpane, .service, .timeline__item, .empty-state, .contact__grid'
);
revealTargets.forEach((el) => el.setAttribute('data-reveal', ''));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

// ============================================================
// Projects — fetch from API and render cards
// ============================================================
const projectGrid = document.getElementById('projectGrid');
const filterButtons = document.querySelectorAll('.filter');
let allProjects = [];

const categoryLabel = { development: 'Development', office: 'Office & Documents' };

function renderProjects(projects) {
  projectGrid.innerHTML = '';

  if (!projects.length) {
    projectGrid.innerHTML = '<p style="color:var(--text-muted)">No projects in this category yet.</p>';
    return;
  }

  projects.forEach((project, index) => {
    const card = document.createElement('article');
    card.className = 'project-card';
    card.style.transitionDelay = `${index * 60}ms`;

    const tags = project.tools.map((t) => `<span class="tag">${t}</span>`).join('');
    const liveLink = project.liveUrl && project.liveUrl !== '#'
      ? `<a href="${project.liveUrl}" target="_blank" rel="noopener">Live site →</a>`
      : '';
    const codeLink = project.codeUrl && project.codeUrl !== '#'
      ? `<a href="${project.codeUrl}" target="_blank" rel="noopener">Source →</a>`
      : '';

    card.innerHTML = `
      <span class="project-card__kicker">${categoryLabel[project.category] || project.category}</span>
      <h3>${project.title}</h3>
      <p>${project.description}</p>
      <div class="tag-row">${tags}</div>
      <div class="project-card__links">${liveLink}${codeLink}</div>
    `;

    projectGrid.appendChild(card);
    revealObserver.observe(card);
    requestAnimationFrame(() => card.classList.add('is-visible'));
  });
}

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    const json = await res.json();
    if (json.success) {
      allProjects = json.data;
      renderProjects(allProjects);
    }
  } catch (err) {
    projectGrid.innerHTML = '<p style="color:var(--text-muted)">Could not load projects right now — the backend may be offline.</p>';
  }
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');

    const filter = btn.dataset.filter;
    const filtered = filter === 'all' ? allProjects : allProjects.filter((p) => p.category === filter);
    renderProjects(filtered);
  });
});

loadProjects();

// ============================================================
// AI Chat Widget — ask about Pascal
// ============================================================
const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

let chatHistory = [];
const chatSuggest = document.getElementById('chatSuggest');

function openChat() {
  chatPanel.hidden = false;
  chatToggle.setAttribute('aria-expanded', 'true');
  chatInput.focus();
}

function closeChat() {
  chatPanel.hidden = true;
  chatToggle.setAttribute('aria-expanded', 'false');
}

chatToggle.addEventListener('click', () => {
  if (chatPanel.hidden) openChat();
  else closeChat();
});
chatClose.addEventListener('click', closeChat);

function addChatMessage(text, sender) {
  const el = document.createElement('div');
  el.className = `chatmsg chatmsg--${sender}`;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

async function sendChatMessage(question) {
  if (!question) return;

  chatSuggest.classList.add('is-hidden');
  addChatMessage(question, 'user');
  chatInput.value = '';
  chatInput.disabled = true;

  const typingEl = addChatMessage('Thinking…', 'bot');
  typingEl.classList.add('chatmsg--typing');

  try {
    const res = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, history: chatHistory })
    });
    const json = await res.json();

    typingEl.remove();

    if (json.success) {
      addChatMessage(json.reply, 'bot');
      chatHistory.push({ role: 'user', content: question });
      chatHistory.push({ role: 'assistant', content: json.reply });
    } else {
      addChatMessage(json.error || "Sorry, I couldn't answer that right now.", 'bot');
    }
  } catch (err) {
    typingEl.remove();
    addChatMessage('Could not reach the assistant. Please try again shortly.', 'bot');
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
}

chatSuggest.querySelectorAll('.chat-suggest__item').forEach((btn) => {
  btn.addEventListener('click', () => sendChatMessage(btn.dataset.q));
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  sendChatMessage(question);
});

// ============================================================
// Contact form submission
// ============================================================
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(contactForm);
  const payload = Object.fromEntries(formData.entries());

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (json.success) {
      formStatus.textContent = json.message;
      formStatus.classList.add('is-success');
      contactForm.reset();
    } else {
      formStatus.textContent = json.error || 'Something went wrong. Please try again.';
      formStatus.classList.add('is-error');
    }
  } catch (err) {
    formStatus.textContent = 'Could not reach the server. Please try again shortly.';
    formStatus.classList.add('is-error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send message';
  }
});
