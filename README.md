# Pascal Lantam Gbate — Portfolio

Express + MongoDB portfolio with a built-in admin dashboard. Everything on the page
(profile, about, skills, experience, services, projects, links, photo, CV) is edited
from `/admin/` — no code changes or redeploys needed. Contact-form messages are read
there too.

## Folder layout

```
portfolio/
├── server.js                 app entry point
├── package.json
├── .env.example              every setting the app understands
├── data/defaultContent.js    the content the site starts with (copied into MongoDB on first boot)
├── middleware/               login/session + rate limiting
├── models/                   Message, Project, SiteContent, Asset
├── routes/                   public API + admin API
├── utils/                    validation, rendering, content loading, mailer, AI knowledge
└── public/
    ├── index.html            the page (regions between <!--region:x--> markers are filled from the database)
    ├── style.css, script.js
    ├── images/               logo, favicon, share image, default photo
    └── admin/                the dashboard (index.html, admin.css, admin.js)
```

## Settings (Render → Environment)

| Variable | Needed for |
|---|---|
| `MONGODB_URI` | everything that is saved |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ chars), `JWT_SECRET` (32+ chars) | the dashboard |
| `GROQ_API_KEY` | the AI assistant |
| `EMAIL_USER`, `EMAIL_PASS`, `NOTIFY_EMAIL` | email alerts (optional) |

Generate `JWT_SECRET`:

    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

## Run locally

    npm install
    cp .env.example .env      # then fill it in
    npm start                 # http://localhost:5000  ·  dashboard: http://localhost:5000/admin/

## How it works

* First boot copies the default content into MongoDB. After that the database is the
  source of truth and the dashboard edits it. If the database is ever unreachable the
  site serves the built-in defaults instead of breaking.
* The home page is rendered on the server from the database, so edits show immediately
  and visitors never see old text flash first.
* The AI assistant builds its knowledge from the same content, so it is never out of date.
* Photo and CV uploads are stored in MongoDB (Render's disk is wiped on every deploy).

## Security notes

* Dashboard login: rate-limited (5 wrong tries per IP / 15 min), session cookie is
  HttpOnly + SameSite=Strict + Secure on https, tokens expire after 12 hours.
* Every saved value is validated; links are limited to https / mailto / tel.
* Visitor messages are shown in the dashboard as plain text only, never as HTML.
* To change your password, change `ADMIN_PASSWORD` on Render and redeploy.
