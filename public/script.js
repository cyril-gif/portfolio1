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
    const res = await fetch('/api/projects');
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
    const res = await fetch('/api/contact', {
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
