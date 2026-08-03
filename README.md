# Cyril Pascal — Portfolio

Full-stack personal portfolio. Vanilla HTML/CSS/JS frontend, served and backed by an Express + MongoDB API.

## What's inside

```
portfolio/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── models/
│   └── Message.js       (Mongoose schema for contact messages)
├── routes/
│   ├── contact.js        (POST/GET /api/contact)
│   └── projects.js       (GET /api/projects)
├── server.js
├── package.json
├── .env.example
└── README.md
```

## 1. Local setup

```bash
cd portfolio
npm install
cp .env.example .env
```

Open `.env` and fill in `MONGODB_URI`:

- **Free MongoDB Atlas cluster:** create one at https://www.mongodb.com/cloud/atlas, add a database user, allow your IP (or `0.0.0.0/0` for quick testing), then copy the connection string into `.env`.
- Leave `PORT` as `5000` unless that port is taken on your machine.

## 2. Run it

```bash
npm start
```

Visit **http://localhost:5000** — the Express server serves the frontend from `/public` and exposes the API on `/api/*`.

For auto-restart on file changes during development:

```bash
npm run dev
```

## 3. Before you go live — things to personalize

- Replace the `.about__photo-placeholder` block in `index.html` with a real `<img>` tag pointing to your photo.
- Add a real `cv.pdf` file to `public/` (the "Download CV" button already links to `/cv.pdf`).
- Update the social links in the Contact section (`LinkedIn`, `GitHub`, `WhatsApp`, `Email`) with your real URLs.
- Edit `routes/projects.js` to add/update your real projects — the frontend pulls this list live from the API.
- Swap the accent colors in `style.css` (`--gold` / `--blue` at the top of the file) if you want a different palette; everything else references those two variables.

## 4. Deployment

### Option A — one platform for everything (simplest)
Since Express already serves the static frontend, you can deploy the whole `portfolio/` folder as a single app:

1. Push this project to a GitHub repo.
2. On **Render** (render.com): New → Web Service → connect the repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables `MONGODB_URI` and `PORT` in the Render dashboard.
3. Render gives you a live URL — done. No separate frontend deployment needed.

### Option B — split frontend and backend
If you'd rather host the static site on Vercel and the API separately:

1. **Backend on Render:** same steps as above, but you'll get an API URL like `https://your-api.onrender.com`.
2. **Frontend on Vercel:** deploy just the `public/` folder as a static site.
3. In `public/script.js`, change the `fetch('/api/projects')` and `fetch('/api/contact')` calls to point at your full backend URL, e.g. `fetch('https://your-api.onrender.com/api/projects')`.
4. Make sure CORS stays enabled on the backend (`server.js` already has `app.use(cors())`).

Option A is recommended for a portfolio site — one deployment, one URL, less to maintain.
"# portfolio1" 
