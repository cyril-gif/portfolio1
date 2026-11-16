(() => {
  'use strict';

  const app = document.getElementById('app');
  const $ = (sel, root = document) => root.querySelector(sel);
  const state = { me: null, files: null, dirty: false };

  /* ------------------------------------------------------------------
     Tiny DOM helper. Builds elements with textContent only — visitor
     messages are untrusted, so nothing here ever uses innerHTML.
  ------------------------------------------------------------------ */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ---------------------------- API ---------------------------- */
  class ApiError extends Error {
    constructor(message, status, extra) {
      super(message);
      this.status = status;
      this.extra = extra;
    }
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'X-Requested-With': 'admin' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch('/api/admin' + path, {
        method,
        headers,
        credentials: 'same-origin',
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not json */
    }
    if (!res.ok) {
      if (res.status === 401 && path !== '/login' && path !== '/me') {
        state.dirty = false;
        renderLogin('Your session expired. Please sign in again.');
      }
      throw new ApiError(data?.error || `Something went wrong (${res.status}).`, res.status, data);
    }
    return data;
  }

  /* --------------------------- helpers -------------------------- */
  let toastTimer;
  function toast(message, kind = 'ok') {
    let t = $('#toast');
    if (!t) {
      t = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(t);
    }
    t.textContent = message;
    t.className = `toast show ${kind === 'error' ? 'error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 4000);
  }

  function markDirty() {
    state.dirty = true;
    const bar = $('#saveBar');
    if (bar) {
      bar.classList.add('is-dirty');
      $('.savebar__status', bar).textContent = 'Unsaved changes';
    }
  }

  const timeAgo = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fullDate = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  function pageHead(title, sub, emphasis) {
    return h('div', { class: 'page-head' }, h('h1', {}, title, emphasis ? [' ', h('em', {}, emphasis)] : null), sub ? h('p', {}, sub) : null);
  }

  function errorBox(err) {
    return h('div', { class: 'empty' }, err?.message || 'Something went wrong.', ' ', h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => route() }, 'Try again'));
  }

  /* ---------------------------- form bits ---------------------------- */
  function field(label, control, hint) {
    return h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), control, hint ? h('span', { class: 'field__hint' }, hint) : null);
  }

  function input(value, { max, placeholder, onInput, type = 'text', inputmode } = {}) {
    const el = h('input', { type, value: value ?? '', maxlength: max, placeholder, inputmode, autocomplete: 'off' });
    el.addEventListener('input', () => {
      markDirty();
      onInput?.(el.value);
    });
    return el;
  }

  function textarea(value, { rows = 4, max, placeholder, onInput } = {}) {
    const el = h('textarea', { rows, maxlength: max, placeholder });
    el.value = value ?? '';
    el.addEventListener('input', () => {
      markDirty();
      onInput?.(el.value);
    });
    return el;
  }

  function levelControl(value, onChange) {
    const out = h('output', {}, `${value}%`);
    const range = h('input', { type: 'range', min: 0, max: 100, step: 5, value });
    range.addEventListener('input', () => {
      out.textContent = `${range.value}%`;
      markDirty();
      onChange(Number(range.value));
    });
    return h('div', { class: 'level' }, range, out);
  }

  function saveBar(onSave) {
    const status = h('span', { class: 'savebar__status' }, 'All changes saved');
    const btn = h('button', { class: 'btn btn--primary', type: 'button' }, 'Save changes');
    const bar = h('div', { class: 'savebar', id: 'saveBar' }, status, btn);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await onSave();
        state.dirty = false;
        bar.classList.remove('is-dirty');
        status.textContent = 'All changes saved';
        toast('Saved — your site is updated.');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save changes';
      }
    });
    return bar;
  }

  // A list the owner can add to, remove from and re-order.
  function repeater({ items, makeRow, blank, addLabel = '+ Add', max }) {
    const list = h('div', { class: 'rep' });
    const addBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, addLabel);

    function redraw() {
      list.replaceChildren(
        ...items.map((item, i) =>
          h(
            'div',
            { class: 'rep__item' },
            h('div', { class: 'rep__body' }, makeRow(item, i)),
            h(
              'div',
              { class: 'rep__tools' },
              h('button', { type: 'button', class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
              h('button', { type: 'button', class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', disabled: i === items.length - 1, onclick: () => move(i, 1) }, '↓'),
              h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: 'Remove', 'aria-label': 'Remove', onclick: () => remove(i) }, '✕')
            )
          )
        )
      );
      addBtn.hidden = !!max && items.length >= max;
    }
    function move(i, d) {
      const j = i + d;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
      markDirty();
      redraw();
    }
    function remove(i) {
      items.splice(i, 1);
      markDirty();
      redraw();
    }
    addBtn.addEventListener('click', () => {
      items.push(blank());
      markDirty();
      redraw();
    });
    redraw();
    return h('div', {}, list, addBtn);
  }

  const putSection = (name, data) => api(`/content/${name}`, { method: 'PUT', body: data });
  const getContent = async () => {
    const r = await api('/content');
    state.files = r.files;
    return r.content;
  };

  /* ===================================================================
     VIEWS
  =================================================================== */
  const VIEWS = {};

  /* ---------------------------- dashboard ---------------------------- */
  VIEWS.dashboard = async (el) => {
    const o = await api('/overview');
    setBadge(o.messages.unread);

    const statusRow = (label, ok, goodText, badText) =>
      h('li', {}, label, h('span', { class: `pill ${ok ? 'pill--ok' : 'pill--bad'}` }, ok ? goodText : badText));

    el.replaceChildren(
      pageHead('Welcome back', `Signed in as ${state.me}. Everything you change here updates your live site instantly.`),
      h(
        'div',
        { class: 'stats' },
        h('div', { class: 'stat-card' }, h('b', {}, o.messages.unread), h('span', {}, 'Unread messages')),
        h('div', { class: 'stat-card' }, h('b', {}, o.messages.total), h('span', {}, 'Total messages')),
        h('div', { class: 'stat-card' }, h('b', {}, `${o.projects.visible}/${o.projects.total}`), h('span', {}, 'Projects shown')),
        h('div', { class: 'stat-card' }, h('b', {}, o.lastEdited ? timeAgo(o.lastEdited) : '—'), h('span', {}, 'Last edit'))
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Recent messages'),
        h('p', { class: 'card__sub' }, 'The latest people to write to you through the contact form.'),
        o.messages.recent.length
          ? h(
              'div',
              { class: 'msglist' },
              o.messages.recent.map((m) =>
                h(
                  'a',
                  { class: `msg ${m.read ? '' : 'is-unread'}`, href: '#/messages' },
                  h('div', { class: 'msg__top' }, h('span', { class: 'msg__from' }, m.name), h('span', { class: 'msg__time' }, timeAgo(m.createdAt))),
                  h('div', { class: 'msg__subject', role: 'presentation' }, m.subject)
                )
              )
            )
          : h('div', { class: 'empty' }, 'No messages yet. When someone uses your contact form, it appears here.')
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'System status'),
        h(
          'ul',
          { class: 'status-list' },
          statusRow('Database', o.status.database, 'Connected', 'Offline'),
          statusRow(`AI assistant (${o.status.aiModel})`, o.status.ai, 'Ready', 'GROQ_API_KEY missing'),
          statusRow('Email alerts for new messages', o.status.email, 'On', 'Not set up'),
          statusRow('Profile photo', true, o.files.photo.exists ? 'Custom upload' : 'Default', ''),
          statusRow('CV file', true, o.files.cv.exists ? 'Custom upload' : 'Default', '')
        )
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Quick actions'),
        h(
          'div',
          { class: 'quick' },
          h('a', { class: 'btn btn--primary', href: '#/messages' }, 'Read messages'),
          h('a', { class: 'btn btn--ghost', href: '#/projects' }, 'Add a project'),
          h('a', { class: 'btn btn--ghost', href: '#/about' }, 'Edit About'),
          h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, 'View live site ↗')
        )
      )
    );
  };

  /* ----------------------------- messages ----------------------------- */
  VIEWS.messages = async (el) => {
    let filter = 'all';
    let page = 1;
    let items = [];
    let pages = 1;
    let unread = 0;

    const list = h('div', { class: 'msglist' });
    const more = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true, onclick: () => load(false) }, 'Load more');
    const tabAll = h('button', { class: 'tab is-active', type: 'button', onclick: () => setFilter('all') }, 'All');
    const tabUnread = h('button', { class: 'tab', type: 'button', onclick: () => setFilter('unread') }, 'Unread');
    const readAll = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: markAllRead }, 'Mark all read');

    async function load(reset) {
      if (reset) {
        page = 1;
        items = [];
      }
      const r = await api(`/messages?filter=${filter}&page=${page}`);
      items = items.concat(r.items);
      pages = r.pages;
      unread = r.unread;
      page += 1;
      setBadge(unread);
      draw();
    }

    function setFilter(f) {
      filter = f;
      tabAll.classList.toggle('is-active', f === 'all');
      tabUnread.classList.toggle('is-active', f === 'unread');
      load(true).catch((e) => toast(e.message, 'error'));
    }

    async function markAllRead() {
      try {
        await api('/messages/read-all', { method: 'POST' });
        toast('All messages marked as read.');
        await load(true);
      } catch (e) {
        toast(e.message, 'error');
      }
    }

    function draw() {
      readAll.hidden = unread === 0;
      more.hidden = page > pages;
      if (!items.length) {
        list.replaceChildren(h('div', { class: 'empty' }, filter === 'unread' ? 'No unread messages — you are all caught up.' : 'No messages yet. When someone uses your contact form, it shows up here.'));
        return;
      }
      list.replaceChildren(...items.map(messageCard));
    }

    function messageCard(m) {
      const card = h('details', { class: `msg ${m.read ? '' : 'is-unread'}` });
      const readBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, m.read ? 'Mark as unread' : 'Mark as read');

      async function setRead(value) {
        try {
          await api(`/messages/${m.id}`, { method: 'PATCH', body: { read: value } });
          m.read = value;
          card.classList.toggle('is-unread', !value);
          readBtn.textContent = value ? 'Mark as unread' : 'Mark as read';
          unread += value ? -1 : 1;
          setBadge(Math.max(0, unread));
          readAll.hidden = unread <= 0;
        } catch (e) {
          toast(e.message, 'error');
        }
      }
      readBtn.addEventListener('click', () => setRead(!m.read));

      card.addEventListener('toggle', () => {
        if (card.open && !m.read) setRead(true);
      });

      const del = h(
        'button',
        {
          class: 'btn btn--danger btn--sm',
          type: 'button',
          onclick: async () => {
            if (!confirm(`Delete this message from ${m.name}? This cannot be undone.`)) return;
            try {
              await api(`/messages/${m.id}`, { method: 'DELETE' });
              if (!m.read) {
                unread = Math.max(0, unread - 1);
                setBadge(unread);
              }
              items = items.filter((x) => x.id !== m.id);
              draw();
              toast('Message deleted.');
            } catch (e) {
              toast(e.message, 'error');
            }
          }
        },
        'Delete'
      );

      const mailto = `mailto:${encodeURIComponent(m.email).replace(/%40/g, '@')}?subject=${encodeURIComponent('Re: ' + m.subject)}`;
      card.append(
        h('summary', {}, h('div', { class: 'msg__top' }, h('span', { class: 'msg__from' }, m.name), h('span', { class: 'msg__time' }, timeAgo(m.createdAt))), h('div', { class: 'msg__subject' }, m.subject), h('div', { class: 'msg__snippet' }, m.message)),
        h('div', { class: 'msg__body' }, h('p', { class: 'msg__meta' }, `${m.name} <${m.email}> · ${fullDate(m.createdAt)}`), h('p', { class: 'msg__text' }, m.message), h('div', { class: 'msg__actions' }, h('a', { class: 'btn btn--primary btn--sm', href: mailto }, 'Reply by email'), readBtn, del))
      );
      return card;
    }

    el.replaceChildren(pageHead('Messages', 'Everything sent through your contact form. Opening a message marks it as read.'), h('div', { class: 'toolbar' }, h('div', { class: 'tabs' }, tabAll, tabUnread), readAll), list, h('div', { class: 'quick' }, more));
    await load(true);
  };

  /* ------------------------------ profile ------------------------------ */
  VIEWS.profile = async (el) => {
    const d = structuredClone((await getContent()).profile);
    el.replaceChildren(
      pageHead('Profile & hero', 'The big name, headline and intro at the very top of your site.'),
      h(
        'div',
        { class: 'card form-grid' },
        h('div', { class: 'two-col' }, field('First name', input(d.firstName, { max: 40, onInput: (v) => (d.firstName = v) })), field('Last name (shown in gold italic)', input(d.lastName, { max: 60, onInput: (v) => (d.lastName = v) }))),
        field('Role line (small text above your name)', input(d.eyebrow, { max: 120, onInput: (v) => (d.eyebrow = v) })),
        h('div', { class: 'two-col' }, field('Headline — start', input(d.headlineLead, { max: 40, onInput: (v) => (d.headlineLead = v) }), 'Plain text, e.g. “I build”'), field('Headline — italic part', input(d.headlineEm, { max: 200, onInput: (v) => (d.headlineEm = v) }))),
        field('Tag line', input(d.tags, { max: 120, onInput: (v) => (d.tags = v) }), 'Shown with a gold line, e.g. Frontend · Backend · Mobile · AI'),
        field('Intro paragraph', textarea(d.lede, { rows: 6, max: 1200, onInput: (v) => (d.lede = v) })),
        field('Small line under the buttons', input(d.meta, { max: 160, onInput: (v) => (d.meta = v) }))
      ),
      saveBar(() => putSection('profile', d))
    );
  };

  /* ------------------------------- about ------------------------------- */
  VIEWS.about = async (el) => {
    const d = structuredClone((await getContent()).about);
    el.replaceChildren(
      pageHead('About', 'The story section of your site.', 'me'),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Paragraphs'),
        h('p', { class: 'card__sub' }, 'Put **two asterisks** around words to make them bold, like **PascalLinks**.'),
        repeater({
          items: d.paragraphs,
          blank: () => '',
          addLabel: '+ Add paragraph',
          max: 8,
          makeRow: (_, i) => field(`Paragraph ${i + 1}`, textarea(d.paragraphs[i], { rows: 5, max: 1500, onInput: (v) => (d.paragraphs[i] = v) }))
        })
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Highlight numbers'),
        h('p', { class: 'card__sub' }, 'Up to four short facts shown under your story.'),
        repeater({
          items: d.stats,
          blank: () => ({ value: '', label: '' }),
          addLabel: '+ Add number',
          max: 4,
          makeRow: (s) => h('div', { class: 'two-col' }, field('Number', input(s.value, { max: 12, onInput: (v) => (s.value = v) })), field('Label', input(s.label, { max: 40, onInput: (v) => (s.label = v) })))
        })
      ),
      saveBar(() => putSection('about', d))
    );
  };

  /* ------------------------------- skills ------------------------------- */
  VIEWS.skills = async (el) => {
    const d = structuredClone((await getContent()).skills);
    let alsoText = d.also.join(', ');
    el.replaceChildren(
      pageHead('Skills', 'The skill bars and tools shown on your site.', 'tools'),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Development skills'),
        h('p', { class: 'card__sub' }, 'The slider sets how full the bar is.'),
        repeater({
          items: d.dev,
          blank: () => ({ name: '', level: 70 }),
          addLabel: '+ Add skill',
          max: 20,
          makeRow: (s) => h('div', { class: 'form-grid' }, field('Skill', input(s.name, { max: 60, onInput: (v) => (s.name = v) })), levelControl(s.level, (v) => (s.level = v)))
        })
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Office & productivity'),
        repeater({
          items: d.office,
          blank: () => ({ icon: '', name: '', level: 70 }),
          addLabel: '+ Add skill',
          max: 12,
          makeRow: (s) =>
            h(
              'div',
              { class: 'form-grid' },
              h('div', { class: 'two-col' }, field('Letter / icon (1–2 characters)', input(s.icon, { max: 2, onInput: (v) => (s.icon = v) })), field('Skill', input(s.name, { max: 90, onInput: (v) => (s.name = v) }))),
              levelControl(s.level, (v) => (s.level = v))
            )
        })
      ),
      h('div', { class: 'card' }, h('h2', {}, 'Also working with'), field('Tools, separated by commas', input(alsoText, { max: 400, onInput: (v) => (alsoText = v) }), 'e.g. Python, MySQL, PHP, WordPress')),
      saveBar(() => {
        d.also = alsoText;
        return putSection('skills', d);
      })
    );
  };

  /* ----------------------------- experience ----------------------------- */
  VIEWS.experience = async (el) => {
    const items = structuredClone((await getContent()).experience);
    el.replaceChildren(
      pageHead('Experience', 'Your timeline: work, founding, school. Newest first is best.', '& education'),
      h(
        'div',
        { class: 'card' },
        repeater({
          items,
          blank: () => ({ date: '', title: '', description: '' }),
          addLabel: '+ Add entry',
          max: 20,
          makeRow: (e) =>
            h(
              'div',
              { class: 'form-grid' },
              h('div', { class: 'two-col' }, field('Dates', input(e.date, { max: 40, onInput: (v) => (e.date = v) }), 'e.g. 2026 — Present'), field('Title', input(e.title, { max: 120, onInput: (v) => (e.title = v) }))),
              field('What you did', textarea(e.description, { rows: 3, max: 600, onInput: (v) => (e.description = v) }))
            )
        })
      ),
      saveBar(() => putSection('experience', items))
    );
  };

  /* ------------------------------ services ------------------------------ */
  VIEWS.services = async (el) => {
    const items = structuredClone((await getContent()).services);
    el.replaceChildren(
      pageHead('Services', 'What you offer clients.', 'you offer'),
      h(
        'div',
        { class: 'card' },
        repeater({
          items,
          blank: () => ({ mark: '', title: '', description: '' }),
          addLabel: '+ Add service',
          max: 12,
          makeRow: (s) =>
            h(
              'div',
              { class: 'form-grid' },
              h('div', { class: 'two-col' }, field('Icon (1–4 characters)', input(s.mark, { max: 4, onInput: (v) => (s.mark = v) })), field('Title', input(s.title, { max: 80, onInput: (v) => (s.title = v) }))),
              field('Description', textarea(s.description, { rows: 3, max: 400, onInput: (v) => (s.description = v) }))
            )
        })
      ),
      saveBar(() => putSection('services', items))
    );
  };

  /* ------------------------------ projects ------------------------------ */
  VIEWS.projects = async (el) => {
    let rows = (await api('/projects')).data;
    let editing = null; // project id, or 'new'
    const holder = h('div', { class: 'projlist' });

    const blank = () => ({ id: 'new', title: '', category: 'development', description: '', tools: [], liveUrl: '', codeUrl: '', visible: true });

    async function saveOrder() {
      try {
        await api('/projects/reorder', { method: 'PUT', body: { ids: rows.map((r) => r.id) } });
        toast('Order saved.');
      } catch (e) {
        toast(e.message, 'error');
        rows = (await api('/projects')).data;
        draw();
      }
    }
    function move(i, d) {
      const j = i + d;
      if (j < 0 || j >= rows.length) return;
      [rows[i], rows[j]] = [rows[j], rows[i]];
      draw();
      saveOrder();
    }

    function editor(p) {
      const draft = { ...p, toolsText: (p.tools || []).join(', ') };
      const err = h('p', { class: 'form-error', role: 'alert' });
      const saveBtn = h('button', { class: 'btn btn--primary', type: 'button' }, p.id === 'new' ? 'Add project' : 'Save project');

      const catSel = h('select', {}, h('option', { value: 'development', selected: draft.category === 'development' }, 'Development'), h('option', { value: 'office', selected: draft.category === 'office' }, 'Office & documents'));
      catSel.addEventListener('change', () => (draft.category = catSel.value));
      const vis = h('input', { type: 'checkbox', checked: draft.visible });
      vis.addEventListener('change', () => (draft.visible = vis.checked));

      saveBtn.addEventListener('click', async () => {
        err.textContent = '';
        saveBtn.disabled = true;
        try {
          const body = { title: draft.title, category: draft.category, description: draft.description, tools: draft.toolsText, liveUrl: draft.liveUrl, codeUrl: draft.codeUrl, visible: draft.visible };
          if (p.id === 'new') {
            const r = await api('/projects', { method: 'POST', body });
            rows.push(r.data);
          } else {
            const r = await api(`/projects/${p.id}`, { method: 'PUT', body });
            rows = rows.map((x) => (x.id === p.id ? r.data : x));
          }
          editing = null;
          draw();
          toast('Project saved — your site is updated.');
        } catch (e) {
          err.textContent = e.message;
        } finally {
          saveBtn.disabled = false;
        }
      });

      const del =
        p.id === 'new'
          ? null
          : h(
              'button',
              {
                class: 'btn btn--danger',
                type: 'button',
                onclick: async () => {
                  if (!confirm(`Delete “${p.title}”? This cannot be undone. (Tip: untick “Show on site” to hide it instead.)`)) return;
                  try {
                    await api(`/projects/${p.id}`, { method: 'DELETE' });
                    rows = rows.filter((x) => x.id !== p.id);
                    editing = null;
                    draw();
                    toast('Project deleted.');
                  } catch (e) {
                    err.textContent = e.message;
                  }
                }
              },
              'Delete'
            );

      return h(
        'div',
        { class: 'proj__form' },
        field('Title', h('input', { type: 'text', value: draft.title, maxlength: 80, oninput: (e) => (draft.title = e.target.value) })),
        h('div', { class: 'two-col' }, field('Type', catSel), field('Tools used (comma separated)', h('input', { type: 'text', value: draft.toolsText, maxlength: 300, oninput: (e) => (draft.toolsText = e.target.value) }))),
        field('Description', (() => { const t = h('textarea', { rows: 4, maxlength: 500 }); t.value = draft.description; t.addEventListener('input', () => (draft.description = t.value)); return t; })()),
        h('div', { class: 'two-col' }, field('Live site address', h('input', { type: 'text', value: draft.liveUrl, maxlength: 300, placeholder: 'https://…', inputmode: 'url', oninput: (e) => (draft.liveUrl = e.target.value) })), field('Source code address (optional)', h('input', { type: 'text', value: draft.codeUrl, maxlength: 300, placeholder: 'https://github.com/…', inputmode: 'url', oninput: (e) => (draft.codeUrl = e.target.value) }))),
        h('label', { class: 'check' }, vis, 'Show on site'),
        err,
        h('div', { class: 'form-actions' }, saveBtn, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { editing = null; draw(); } }, 'Cancel'), h('span', { class: 'spacer' }), del)
      );
    }

    function draw() {
      const cards = [];
      if (editing === 'new') cards.push(h('div', { class: 'proj' }, h('div', { class: 'proj__row' }, h('div', { class: 'proj__title' }, 'New project')), editor(blank())));
      rows.forEach((p, i) => {
        cards.push(
          h(
            'div',
            { class: `proj ${p.visible ? '' : 'is-hidden'}` },
            h(
              'div',
              { class: 'proj__row' },
              h('div', {}, h('div', { class: 'proj__title' }, p.title), h('div', { class: 'proj__meta' }, h('span', { class: 'pill' }, p.category === 'office' ? 'Office' : 'Development'), p.visible ? null : h('span', { class: 'pill pill--bad' }, 'Hidden'))),
              h(
                'div',
                { class: 'proj__tools' },
                h('button', { class: 'icon-btn', type: 'button', title: 'Move up', 'aria-label': `Move ${p.title} up`, disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
                h('button', { class: 'icon-btn', type: 'button', title: 'Move down', 'aria-label': `Move ${p.title} down`, disabled: i === rows.length - 1, onclick: () => move(i, 1) }, '↓'),
                h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { editing = editing === p.id ? null : p.id; draw(); } }, editing === p.id ? 'Close' : 'Edit')
              )
            ),
            editing === p.id ? editor(p) : null
          )
        );
      });
      holder.replaceChildren(...(cards.length ? cards : [h('div', { class: 'empty' }, 'No projects yet. Add your first one.')]));
    }

    el.replaceChildren(
      pageHead('Projects', 'The work shown on your site. Use the arrows to change the order.', 'work'),
      h('div', { class: 'toolbar' }, h('span', { class: 'muted' }, `${rows.length} project${rows.length === 1 ? '' : 's'}`), h('button', { class: 'btn btn--primary', type: 'button', onclick: () => { editing = 'new'; draw(); } }, '+ Add project')),
      holder
    );
    draw();
  };

  /* ------------------------------- contact ------------------------------- */
  VIEWS.contact = async (el) => {
    const d = structuredClone((await getContent()).contact);
    el.replaceChildren(
      pageHead('Contact & links', 'The text and links in the “Let’s talk” section.'),
      h('div', { class: 'card form-grid' }, field('Text next to the contact form', textarea(d.lede, { rows: 3, max: 400, onInput: (v) => (d.lede = v) }))),
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Links'),
        h('p', { class: 'card__sub' }, 'Use full addresses: https://… for websites, mailto:you@example.com for email, https://wa.me/233XXXXXXXXX for WhatsApp.'),
        repeater({
          items: d.links,
          blank: () => ({ label: '', url: '' }),
          addLabel: '+ Add link',
          max: 8,
          makeRow: (l) => h('div', { class: 'two-col' }, field('Name', input(l.label, { max: 30, onInput: (v) => (l.label = v) })), field('Address', input(l.url, { max: 300, inputmode: 'url', onInput: (v) => (l.url = v) })))
        })
      ),
      saveBar(() => putSection('contact', d))
    );
  };

  /* -------------------------------- files -------------------------------- */
  const toDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read that file.'));
      r.readAsDataURL(file);
    });

  // Shrinks big phone photos in the browser before uploading (keeps them small and fast).
  async function resizeImage(file, maxSide = 900, quality = 0.86) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const hgt = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, hgt);
    ctx.drawImage(bmp, 0, 0, w, hgt);
    return canvas.toDataURL('image/jpeg', quality);
  }

  VIEWS.files = async (el) => {
    await getContent();
    const files = state.files || {};

    function fileCard({ key, title, sub, preview, accept, info, onPick, removeLabel }) {
      const picker = h('input', { type: 'file', accept });
      const msg = h('p', { class: 'form-error', role: 'alert' });
      const uploadBtn = h('button', { class: 'btn btn--primary', type: 'button', disabled: true }, 'Upload');
      let chosen = null;

      picker.addEventListener('change', async () => {
        msg.textContent = '';
        chosen = null;
        uploadBtn.disabled = true;
        const f = picker.files?.[0];
        if (!f) return;
        try {
          chosen = await onPick(f);
          uploadBtn.disabled = false;
        } catch (e) {
          msg.textContent = e.message;
        }
      });
      uploadBtn.addEventListener('click', async () => {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';
        try {
          await api(`/files/${key}`, { method: 'PUT', body: chosen });
          toast(`${title} updated — your site is updated.`);
          route();
        } catch (e) {
          msg.textContent = e.message;
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload';
        }
      });

      const removeBtn = files[key]?.exists
        ? h(
            'button',
            {
              class: 'btn btn--danger',
              type: 'button',
              onclick: async () => {
                if (!confirm(`${removeLabel}`)) return;
                try {
                  await api(`/files/${key}`, { method: 'DELETE' });
                  toast('Reverted to the default.');
                  route();
                } catch (e) {
                  msg.textContent = e.message;
                }
              }
            },
            'Use default again'
          )
        : null;

      return h('div', { class: 'card file-card' }, preview, h('div', { class: 'file-info' }, h('h2', {}, title), h('p', {}, sub), info ? h('p', {}, info) : null, picker, msg, h('div', { class: 'form-actions' }, uploadBtn, removeBtn)));
    }

    const photo = files.photo || {};
    const cv = files.cv || {};

    el.replaceChildren(
      pageHead('Photo & CV', 'Replace your profile photo and downloadable CV without touching any code.'),
      fileCard({
        key: 'photo',
        title: 'Profile photo',
        sub: 'Shown in the About section. A square-ish photo works best — big phone photos are shrunk automatically.',
        info: photo.exists ? `Custom photo · ${kb(photo.size)} · updated ${timeAgo(photo.updatedAt)}` : 'Using the default photo from your site files.',
        preview: h('img', { class: 'photo-preview', alt: 'Current profile photo', src: photo.exists ? `/api/asset/photo?v=${Date.parse(photo.updatedAt)}` : '/images/pass.png' }),
        accept: 'image/jpeg,image/png,image/webp',
        removeLabel: 'Go back to the default photo?',
        onPick: async (f) => {
          if (!f.type.startsWith('image/')) throw new Error('Please choose an image (JPG, PNG or WebP).');
          const dataUrl = await resizeImage(f);
          return { dataUrl, filename: f.name };
        }
      }),
      fileCard({
        key: 'cv',
        title: 'CV (PDF)',
        sub: 'The file visitors download from the “Download CV” button.',
        info: cv.exists ? `Custom CV · ${cv.filename} · ${kb(cv.size)} · updated ${timeAgo(cv.updatedAt)}` : 'Using the default cv.pdf from your site files.',
        preview: h('div', { class: 'file-icon', 'aria-hidden': 'true' }, 'PDF'),
        accept: 'application/pdf',
        removeLabel: 'Go back to the default CV file?',
        onPick: async (f) => {
          if (f.type !== 'application/pdf') throw new Error('Please choose a PDF file.');
          if (f.size > 3 * 1024 * 1024) throw new Error('That PDF is too large (max 3 MB).');
          return { dataUrl: await toDataUrl(f), filename: f.name };
        }
      })
    );
  };

  /* ------------------------------ site & ai ------------------------------ */
  VIEWS.site = async (el) => {
    const d = structuredClone((await getContent()).site);
    let tickerText = d.ticker.join(', ');
    el.replaceChildren(
      pageHead('Site & AI', 'Page title, search/share text, and extra facts for your AI assistant.', '& AI'),
      h(
        'div',
        { class: 'card form-grid' },
        h('h2', {}, 'Search & sharing'),
        field('Page title', input(d.seoTitle, { max: 120, onInput: (v) => (d.seoTitle = v) }), 'Shown in the browser tab and Google results.'),
        field('Search description', textarea(d.seoDescription, { rows: 3, max: 300, onInput: (v) => (d.seoDescription = v) }), 'The short text under your link in Google.'),
        field('Share preview description', textarea(d.shareDescription, { rows: 3, max: 300, onInput: (v) => (d.shareDescription = v) }), 'Shown when you share your link on LinkedIn or WhatsApp.')
      ),
      h(
        'div',
        { class: 'card form-grid' },
        h('h2', {}, 'Other text'),
        field('Scrolling strip words (commas)', input(tickerText, { max: 800, onInput: (v) => (tickerText = v) }), 'The tech names that scroll under the top section.'),
        field('Footer line', input(d.footerNote, { max: 120, onInput: (v) => (d.footerNote = v) }))
      ),
      h(
        'div',
        { class: 'card form-grid' },
        h('h2', {}, 'AI assistant'),
        h('p', { class: 'card__sub' }, 'The assistant already knows everything on your site — it reads your profile, skills, projects and experience automatically. Add anything extra here (availability, rates, things not shown on the page).'),
        field('Extra notes for the AI', textarea(d.aiNotes, { rows: 6, max: 2000, onInput: (v) => (d.aiNotes = v) }))
      ),
      saveBar(() => {
        d.ticker = tickerText;
        return putSection('site', d);
      })
    );
  };

  /* ===================================================================
     SHELL, ROUTING, LOGIN
  =================================================================== */
  const NAV = [
    ['dashboard', 'Dashboard'],
    ['messages', 'Messages'],
    ['profile', 'Profile & hero'],
    ['about', 'About'],
    ['skills', 'Skills'],
    ['experience', 'Experience'],
    ['services', 'Services'],
    ['projects', 'Projects'],
    ['contact', 'Contact & links'],
    ['files', 'Photo & CV'],
    ['site', 'Site & AI']
  ];

  function setBadge(n) {
    const b = $('#unreadBadge');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
  }

  async function refreshBadge() {
    try {
      setBadge((await api('/unread')).count);
    } catch {
      /* ignore */
    }
  }

  let currentRoute = 'dashboard';

  function route() {
    const id = location.hash.replace(/^#\//, '') || 'dashboard';
    const view = VIEWS[id] ? id : 'dashboard';
    currentRoute = view;
    document.querySelectorAll('.nav__link').forEach((a) => a.classList.toggle('is-active', a.dataset.id === view));
    const el = $('#view');
    if (!el) return;
    el.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    VIEWS[view](el)
      .then(() => window.scrollTo(0, 0))
      .catch((err) => {
        if (err.status !== 401) el.replaceChildren(errorBox(err));
      });
    refreshBadge();
  }

  window.addEventListener('hashchange', () => {
    if (!state.me) return;
    if (state.dirty && !confirm('You have unsaved changes. Leave without saving?')) {
      history.replaceState(null, '', `#/${currentRoute}`);
      return;
    }
    state.dirty = false;
    route();
  });
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function renderShell() {
    const nav = h(
      'nav',
      { class: 'nav', 'aria-label': 'Dashboard sections' },
      NAV.map(([id, label]) => h('a', { href: `#/${id}`, 'data-id': id, class: 'nav__link' }, label, id === 'messages' ? h('span', { class: 'badge', id: 'unreadBadge', hidden: true }) : null))
    );
    app.replaceChildren(
      h(
        'div',
        { class: 'shell' },
        h(
          'header',
          { class: 'topbar' },
          h('a', { class: 'brand', href: '#/dashboard' }, h('img', { src: '/images/logo-mark.png', alt: '', width: 24, height: 26 }), h('span', {}, 'Dashboard')),
          h('div', { class: 'topbar__actions' }, h('a', { class: 'btn btn--ghost btn--sm', href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'), h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: logout }, 'Sign out'))
        ),
        h('div', { class: 'shell__body' }, h('aside', { class: 'sidebar' }, nav), h('main', { class: 'main', id: 'view', tabindex: '-1' }))
      )
    );
  }

  async function logout() {
    if (state.dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    state.dirty = false;
    renderLogin();
  }

  function renderSetup(problems) {
    app.replaceChildren(
      h(
        'div',
        { class: 'login-wrap' },
        h(
          'div',
          { class: 'login-card' },
          h('img', { src: '/images/logo-mark.png', alt: '', width: 36, height: 39 }),
          h('h1', {}, 'Almost ', h('em', {}, 'ready')),
          h('p', { class: 'muted' }, 'The dashboard is switched off until you add these settings on Render (Environment tab):'),
          h('ul', { class: 'setup-list' }, problems.map((p) => h('li', {}, p))),
          h('ol', { class: 'setup-steps' }, h('li', {}, 'Open your service on Render → Environment.'), h('li', {}, 'Add the missing variables, then save. Render redeploys by itself.'), h('li', {}, 'Come back to this page and sign in.'))
        )
      )
    );
  }

  function renderLogin(notice) {
    state.me = null;
    state.dirty = false;
    const err = h('p', { class: 'form-error', role: 'alert' }, notice || '');
    const email = h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, autofocus: true });
    const pass = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true });
    const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Sign in');

    const form = h(
      'form',
      {
        class: 'login-card',
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          err.textContent = '';
          btn.disabled = true;
          btn.textContent = 'Signing in…';
          try {
            const r = await api('/login', { method: 'POST', body: { email: email.value, password: pass.value } });
            state.me = r.email;
            pass.value = '';
            renderShell();
            route();
          } catch (ex) {
            if (ex.status === 503 && ex.extra?.problems) return renderSetup(ex.extra.problems);
            err.textContent = ex.message;
            pass.value = '';
            btn.disabled = false;
            btn.textContent = 'Sign in';
          }
        }
      },
      h('img', { src: '/images/logo-mark.png', alt: '', width: 36, height: 39 }),
      h('h1', {}, 'Welcome ', h('em', {}, 'back')),
      field('Email', email),
      field('Password', pass),
      err,
      btn
    );
    app.replaceChildren(h('div', { class: 'login-wrap' }, form));
  }

  async function start() {
    try {
      const me = await api('/me');
      state.me = me.email;
      renderShell();
      route();
    } catch (e) {
      if (e.status === 503) return renderSetup(e.extra?.problems || ['Admin settings are missing']);
      renderLogin();
    }
  }

  start();
})();
