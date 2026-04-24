// ══════════════════════════════════════════════════════════════════════════
// server.js
// Portfolio + layered puzzle + guestbook backend.
// Minimal deps: express, better-sqlite3. No ORMs. No build step.
// Serves the site at /, hidden puzzle routes at /rabbit /cra-0004 /signal,
// a data-layer endpoint at /signal.json, and a real REST API for the
// guestbook at /api/guestbook.
// ══════════════════════════════════════════════════════════════════════════

import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'guestbook.db');

// ─── DB ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS guestbook (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT,
    message            TEXT NOT NULL,
    github             TEXT,
    solution           TEXT NOT NULL,
    steps_completed    TEXT,                   -- JSON array of step keys
    time_to_complete   INTEGER,                -- milliseconds, may be null
    ip_hash            TEXT,                   -- coarse rate-limit key
    timestamp          INTEGER NOT NULL        -- unix ms
  );
  CREATE INDEX IF NOT EXISTS idx_gb_timestamp ON guestbook(timestamp DESC);
`);

// ─── APP ───────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// very small in-process rate-limit for POST /api/guestbook
// (prevents casual spam; not meant as real auth)
const rateBucket = new Map(); // ip -> [timestamps]
function rateLimit(ip, windowMs = 60_000, max = 5) {
  const now = Date.now();
  const hits = (rateBucket.get(ip) || []).filter(t => now - t < windowMs);
  hits.push(now);
  rateBucket.set(ip, hits);
  return hits.length <= max;
}

function hashIp(ip) {
  // tiny non-cryptographic hash — just for coarse per-ip bucketing
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return 'h' + Math.abs(h).toString(36);
}

// ─── GUESTBOOK API ─────────────────────────────────────────────────────────
// GET /api/guestbook -> { entries: [...] }
// POST /api/guestbook -> { ok: true, id }
app.get('/api/guestbook', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = db.prepare(`
    SELECT id, name, message, github, solution, steps_completed,
           time_to_complete, timestamp
    FROM guestbook
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit);
  const entries = rows.map(r => ({
    ...r,
    steps_completed: safeParse(r.steps_completed) || [],
  }));
  res.json({ entries, count: entries.length });
});

app.post('/api/guestbook', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
          || req.socket.remoteAddress
          || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ ok: false, error: 'too many submissions. slow down.' });
  }

  const {
    name, message, github, solution,
    steps_completed, time_to_complete,
  } = req.body || {};

  // validate
  const msg = (message || '').toString().trim();
  const sol = (solution || '').toString().trim();
  if (!msg) return res.status(400).json({ ok: false, error: 'message required' });
  if (!sol) return res.status(400).json({ ok: false, error: 'solution required' });
  if (msg.length > 500)  return res.status(400).json({ ok: false, error: 'message too long' });
  if (sol.length > 4000) return res.status(400).json({ ok: false, error: 'solution too long' });

  const cleanName   = ((name   || '').toString().trim() || null)?.slice(0, 40);
  const cleanGithub = sanitizeGithub(github);
  const cleanSteps  = Array.isArray(steps_completed)
    ? steps_completed.filter(s => typeof s === 'string').slice(0, 24)
    : [];
  const ttc = Number.isFinite(+time_to_complete) ? Math.max(0, +time_to_complete) : null;

  const info = db.prepare(`
    INSERT INTO guestbook
      (name, message, github, solution, steps_completed, time_to_complete, ip_hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanName,
    msg.slice(0, 500),
    cleanGithub,
    sol.slice(0, 4000),
    JSON.stringify(cleanSteps),
    ttc,
    hashIp(ip),
    Date.now(),
  );

  res.json({ ok: true, id: info.lastInsertRowid });
});

function sanitizeGithub(raw) {
  if (!raw) return null;
  const s = raw.toString().trim();
  // accept github username or full url; store canonical username
  const m = s.match(/github\.com\/([a-z0-9-]{1,39})/i) || s.match(/^@?([a-z0-9-]{1,39})$/i);
  return m ? m[1].toLowerCase() : null;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ─── LEVEL 5 — hidden data layer ───────────────────────────────────────────
// /signal.json returns the cipher. No UI. Curl-friendly.
// sequence [3,1,18,12,15] under A1Z26 decodes to CARLO — which is the next
// keyboard trigger.
app.get('/signal.json', (req, res) => {
  res.json({
    message: 'patterns reveal intent',
    sequence: [3, 1, 18, 12, 15],
    hint: 'A1Z26',
  });
});

// ─── HIDDEN PUZZLE ROUTES ──────────────────────────────────────────────────
// These are standalone HTML files that reuse the site's aesthetic.
// They're not linked from the nav. Reachable by URL only.
app.get('/rabbit',   (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'rabbit.html')));
app.get('/cra-0004', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'cra-0004.html')));
app.get('/signal',   (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'signal.html')));

// ─── STATIC (main site) ────────────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, fp) {
    // cache static assets, not the main HTML (we want live console + DOM)
    if (fp.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// SPA-style fallback: unknown routes go to the main site
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ─── BOOT ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[carlo] portfolio + puzzle running on http://localhost:${PORT}`);
  console.log(`[carlo] db: ${DB_PATH}`);
});
