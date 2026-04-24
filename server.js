// ══════════════════════════════════════════════════════════════════════════
// server.js
// Portfolio + layered puzzle + guestbook backend.
// Minimal deps: express, better-sqlite3. No ORMs. No build step.
//
// Server-side verification: each puzzle level issues a short-lived HMAC
// token. Guestbook POST requires all tokens to be present and valid.
// ══════════════════════════════════════════════════════════════════════════

import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'guestbook.db');
const PUZZLE_SECRET = process.env.PUZZLE_SECRET || 'dev-secret-change-me-in-production';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    steps_completed    TEXT,
    time_to_complete   INTEGER,
    ip_hash            TEXT,
    timestamp          INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_gb_timestamp ON guestbook(timestamp DESC);
`);

// ─── TOKEN UTILITIES ──────────────────────────────────────────────────────
function sign(payload) {
  return crypto.createHmac('sha256', PUZZLE_SECRET).update(payload).digest('hex').slice(0, 32);
}
function makeToken(level) {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${level}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}
function verifyToken(token, expectedLevel) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [level, expiryStr, sig] = parts;
  if (level !== expectedLevel) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = sign(`${level}.${expiryStr}`);
  // constant-time compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// level definitions
const ANSWER_LEVELS = {
  L4_ship: 'SHIP',
  L6_carlo: 'CARLO',
};
const REQUIRED_LEVELS = ['L1_rabbit', 'L2_cra0004', 'L4_ship', 'L5_signal', 'L6_carlo'];

// ─── APP ───────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// small in-process rate-limit
const rateBucket = new Map();
function rateLimit(ip, windowMs = 60_000, max = 5) {
  const now = Date.now();
  const hits = (rateBucket.get(ip) || []).filter(t => now - t < windowMs);
  hits.push(now);
  rateBucket.set(ip, hits);
  return hits.length <= max;
}
function hashIp(ip) {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
  return 'h' + Math.abs(h).toString(36);
}

// ─── PUZZLE CLAIM ENDPOINT (answer-based levels only) ─────────────────────
// Route-based levels (L1/L2/L5) get their tokens embedded in the served
// HTML — the server controls the response, so the client can't forge.
app.post('/api/puzzle/claim', (req, res) => {
  const { level, answer } = req.body || {};
  if (typeof level !== 'string') return res.status(400).json({ ok: false, error: 'level required' });
  const expected = ANSWER_LEVELS[level];
  if (!expected) return res.status(400).json({ ok: false, error: 'unknown level' });
  if ((answer || '').toString().toUpperCase() !== expected) {
    return res.status(403).json({ ok: false, error: 'wrong answer' });
  }
  return res.json({ ok: true, token: makeToken(level) });
});

// ─── GUESTBOOK API ─────────────────────────────────────────────────────────
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
    tokens,
  } = req.body || {};

  // ── verify puzzle tokens ──
  const t = tokens && typeof tokens === 'object' ? tokens : {};
  const missing = REQUIRED_LEVELS.filter(lvl => !verifyToken(t[lvl], lvl));
  if (missing.length > 0) {
    return res.status(403).json({
      ok: false,
      error: 'puzzle incomplete',
      missing_levels: missing,
      hint: 'complete all 6 levels before signing. see /rabbit',
    });
  }

  // ── validate text ──
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
  const m = s.match(/github\.com\/([a-z0-9-]{1,39})/i) || s.match(/^@?([a-z0-9-]{1,39})$/i);
  return m ? m[1].toLowerCase() : null;
}
function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ─── LEVEL 5 — hidden data layer ───────────────────────────────────────────
app.get('/signal.json', (req, res) => {
  res.json({
    message: 'patterns reveal intent',
    sequence: [3, 1, 18, 12, 15],
    hint: 'A1Z26',
  });
});

// ─── ROUTE-BASED PUZZLE PAGES (token embedded at render) ──────────────────
// The HTML files contain the literal string __LEVEL_TOKEN__ which we
// replace with a freshly-minted signed token at serve time. This lets the
// client store a token it couldn't possibly have forged.
function serveWithToken(file, level) {
  return (_req, res) => {
    try {
      const html = readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
      const token = makeToken(level);
      res.type('html').set('Cache-Control', 'no-store').send(html.replace('__LEVEL_TOKEN__', token));
    } catch (e) {
      res.status(500).send('error');
    }
  };
}
app.get('/rabbit',   serveWithToken('rabbit.html',   'L1_rabbit'));
app.get('/cra-0004', serveWithToken('cra-0004.html', 'L2_cra0004'));
app.get('/signal',   serveWithToken('signal.html',   'L5_signal'));

// ─── STATIC ────────────────────────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, fp) {
    if (fp.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ─── BOOT ──────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[carlo] portfolio + puzzle running on http://localhost:${PORT}`);
  console.log(`[carlo] db: ${DB_PATH}`);
  if (PUZZLE_SECRET === 'dev-secret-change-me-in-production') {
    console.warn('[carlo] WARNING: using dev puzzle secret. set PUZZLE_SECRET in production.');
  }
});
