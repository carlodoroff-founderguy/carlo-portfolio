// ══════════════════════════════════════════════════════════════════════════
// server.js
// Portfolio + SIGNAL CHAIN v2 + guestbook backend.
// Minimal deps: express, better-sqlite3. No ORMs. No build step.
//
// ── Design note (read this before you "optimize" it) ──────────────────────
// The puzzle is server-authoritative and cryptographically chained. The source
// contains ONLY machinery: HMAC keys, SHA-256 checks, ciphertext, and per-
// session derivations keyed on PUZZLE_SECRET. No answer, no token, and no
// plaintext solution exists in any file you can read. Reading the repo tells
// you HOW the lock works, not the combination — the combination is different
// for every solver and is minted at runtime from a random session id.
//
// There is exactly one way through: do the work, in order, per session.
//   start → MINE (proof-of-work) → DECRYPT (Vigenère, key you earned) →
//   RELIC (decode artifact) → SOLVED (single unforgeable proof).
//
// The old SHIP / CARLO / /signal.json / /api/puzzle/claim surface is kept
// ALIVE ON PURPOSE as honeypots. Anything that bites a honeypot is logged to
// the shadow wall. If you found a "skeleton key" in a comment, it's a tripwire.
// ══════════════════════════════════════════════════════════════════════════

import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'guestbook.db');
const PUZZLE_SECRET = process.env.PUZZLE_SECRET || 'dev-secret-change-me-in-production';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// proof-of-work difficulty, in leading zero BITS. ~2^BITS hashes expected.
// 18 ≈ a couple seconds in-browser. Bump for production.
const POW_BITS = Math.max(8, Math.min(28, parseInt(process.env.PUZZLE_POW_BITS, 10) || 18));

// stage ladder. token carries the highest CLEARED stage index.
// the descent: mine the carrier, decrypt the burst, sum the gematria,
// factor the totient, name the relic. six locks, in order.
const STAGE = { START: 0, MINE: 1, DECRYPT: 2, GEMATRIA: 3, PRIME: 4, RELIC: 5, SOLVED: 6 };
const SOLVED_STAGE = STAGE.SOLVED;

// ─── GEMATRIA PRIMUS ─────────────────────────────────────────────────────────
// the authentic Cicada 3301 rune→prime table (single-letter runes only, so the
// transcription is unambiguous). a rune string's "gematria" is the sum of its
// runes' prime values.
const GEMATRIA = [
  ['ᚠ',2],['ᚢ',3],['ᚦ',5],['ᚩ',7],['ᚱ',11],['ᚲ',13],['ᚷ',17],['ᚹ',19],
  ['ᚻ',23],['ᚾ',29],['ᛁ',31],['ᛈ',41],['ᛉ',43],['ᛋ',47],['ᛏ',53],['ᛒ',59],
  ['ᛖ',61],['ᛗ',67],['ᛚ',71],['ᛞ',83],['ᚪ',89],['ᚣ',101],
];

// ─── DB ────────────────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
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

  CREATE TABLE IF NOT EXISTS shadow (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash   TEXT,
    kind      TEXT NOT NULL,
    detail    TEXT,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shadow_ts ON shadow(timestamp DESC);
`);
// best-effort migration for older DBs missing the proof column
try {
  const cols = db.prepare(`PRAGMA table_info(guestbook)`).all().map(c => c.name);
  if (!cols.includes('solved_sid')) db.exec(`ALTER TABLE guestbook ADD COLUMN solved_sid TEXT`);
} catch { /* fresh db already has it / ignore */ }

// ─── CRYPTO PRIMITIVES ──────────────────────────────────────────────────────
function hmac(payload) {
  return crypto.createHmac('sha256', PUZZLE_SECRET).update(payload).digest();
}
function hmacHex(payload) {
  return hmac(payload).toString('hex');
}
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}
// constant-time string compare
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
// map an HMAC digest to N uppercase A–Z letters (deterministic per seed)
function deriveLetters(seed, n) {
  const h = hmac(seed);
  let out = '';
  for (let i = 0; i < n; i++) out += String.fromCharCode(65 + (h[i % h.length] % 26));
  return out;
}
function leadingZeroBits(buf) {
  let n = 0;
  for (const b of buf) {
    if (b === 0) { n += 8; continue; }
    let v = b;
    while ((v & 0x80) === 0) { n++; v <<= 1; }
    break;
  }
  return n;
}
// classic Vigenère over A–Z. dir = +1 encrypt, -1 decrypt.
function vigenere(text, key, dir) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const t = text.charCodeAt(i) - 65;
    const k = key.charCodeAt(i % key.length) - 65;
    out += String.fromCharCode(65 + (((t + dir * k) % 26) + 26) % 26);
  }
  return out;
}

// largest prime factor of n (trial division — n is bounded, so this is fine)
function largestPrimeFactor(n) {
  let v = n, lpf = 1;
  for (let f = 2; f * f <= v; f++) {
    while (v % f === 0) { lpf = f; v /= f; }
  }
  if (v > 1) lpf = v;
  return lpf;
}

// ─── PER-SESSION SECRETS (derived; never stored, never shipped) ─────────────
const powPrefix   = (sid) => hmacHex(`pow|${sid}`).slice(0, 16);
const earnedKey   = (sid) => deriveLetters(`key|${sid}`, 5);   // PoW reward → Vigenère key
const passphrase  = (sid) => deriveLetters(`pass|${sid}`, 7);  // DECRYPT answer
const relicCode   = (sid) => deriveLetters(`relic|${sid}`, 6); // RELIC answer
const cipherText  = (sid) => vigenere(passphrase(sid), earnedKey(sid), +1);
const relicBlob   = (sid) => Buffer.from(relicCode(sid).split('').reverse().join(''), 'utf8').toString('base64');

// GEMATRIA stage: a per-session sequence of runes; answer = sum of their primes.
function runeSeq(sid) {
  const h = hmac(`rune|${sid}`);
  const len = 5 + (h[0] % 3); // 5–7 runes
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(GEMATRIA[h[i + 1] % GEMATRIA.length]);
  return seq;
}
const runeGlyphs  = (sid) => runeSeq(sid).map(r => r[0]).join('');
const gematriaSum = (sid) => runeSeq(sid).reduce((a, r) => a + r[1], 0);

// PRIME stage: a per-session composite N; answer = its largest prime factor.
// N derived in [120000, 9999999], forced even-ish/composite by construction.
const primeN      = (sid) => 120000 + (parseInt(hmacHex(`prime|${sid}`).slice(0, 8), 16) % 9879999);
const primeAnswer = (sid) => largestPrimeFactor(primeN(sid));

// ─── CHAIN TOKEN (stateless, signed) ────────────────────────────────────────
// token = sid.stage.expiry.sig — sig binds all three to PUZZLE_SECRET.
function makeChain(sid, stage) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${sid}.${stage}.${exp}`;
  return `${payload}.${hmacHex(payload).slice(0, 32)}`;
}
function readChain(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [sid, stageStr, expStr, sig] = parts;
  if (!/^[0-9a-f]{24}$/.test(sid)) return null;
  const stage = Number(stageStr);
  const exp = Number(expStr);
  if (!Number.isInteger(stage) || !Number.isFinite(exp) || exp < Date.now()) return null;
  if (!safeEqual(hmacHex(`${sid}.${stageStr}.${expStr}`).slice(0, 32), sig)) return null;
  return { sid, stage, exp };
}

// ─── APP ───────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.set('trust proxy', true);

const rateBucket = new Map();
// independent buckets per (namespace, ip) so the chain's many small requests
// don't starve the guestbook's tighter limit (they used to share one bucket).
function rateLimit(ns, ip, windowMs = 60_000, max = 30) {
  const key = ns + '|' + ip;
  const now = Date.now();
  const hits = (rateBucket.get(key) || []).filter(t => now - t < windowMs);
  hits.push(now);
  rateBucket.set(key, hits);
  return hits.length <= max;
}
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket.remoteAddress || 'unknown';
}
function hashIp(ip) {
  return 'h' + hmacHex(`ip|${ip}`).slice(0, 12);
}
function flagShadow(req, kind, detail = '') {
  try {
    db.prepare(`INSERT INTO shadow (ip_hash, kind, detail, timestamp) VALUES (?,?,?,?)`)
      .run(hashIp(clientIp(req)), String(kind).slice(0, 40), String(detail).slice(0, 200), Date.now());
  } catch { /* never let logging break a request */ }
}

// ─── SIGNAL CHAIN: START ─────────────────────────────────────────────────────
app.post('/api/chain/start', (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit('chain', ip, 60_000, 90)) return res.status(429).json({ ok: false, error: 'slow down' });
  const sid = crypto.randomBytes(12).toString('hex');
  return res.json({
    ok: true,
    chain: makeChain(sid, STAGE.START),
    stage: 'mine',
    pow: { prefix: powPrefix(sid), bits: POW_BITS, algo: 'sha256(prefix + ":" + nonce)' },
    manifesto: 'no map. no hints. mine the carrier, decrypt the burst, sum the gematria, factor the totient, name the relic. five locks, in order.',
  });
});

// ─── SIGNAL CHAIN: STEP ──────────────────────────────────────────────────────
app.post('/api/chain/step', (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit('chain', ip, 60_000, 90)) return res.status(429).json({ ok: false, error: 'slow down' });

  const { chain, answer } = req.body || {};
  const cur = readChain(chain);
  if (!cur) return res.status(403).json({ ok: false, error: 'no valid chain. POST /api/chain/start first.' });

  const { sid } = cur;
  const target = cur.stage + 1;
  const ans = (answer == null ? '' : String(answer)).trim();

  // ── stage 1: MINE (proof-of-work) ──
  if (target === STAGE.MINE) {
    const digest = sha256(Buffer.from(`${powPrefix(sid)}:${ans}`));
    if (ans.length === 0 || leadingZeroBits(digest) < POW_BITS) {
      return res.status(403).json({ ok: false, error: 'carrier not locked', need_bits: POW_BITS });
    }
    return res.json({
      ok: true,
      chain: makeChain(sid, STAGE.MINE),
      stage: 'decrypt',
      reward: { key: earnedKey(sid) },
      cipher: { scheme: 'vigenere', alphabet: 'A-Z', ciphertext: cipherText(sid) },
      note: 'the burst is Vigenère. you just earned the key. decrypt → submit the plaintext.',
    });
  }

  // ── stage 2: DECRYPT (Vigenère plaintext) ──
  if (target === STAGE.DECRYPT) {
    if (!safeEqual(ans.toUpperCase(), passphrase(sid))) {
      return res.status(403).json({ ok: false, error: 'plaintext rejected' });
    }
    return res.json({
      ok: true,
      chain: makeChain(sid, STAGE.DECRYPT),
      stage: 'gematria',
      gematria: { runes: runeGlyphs(sid), table: GEMATRIA },
      note: 'a sequence in the old hand. each rune is a prime. submit the sum.',
    });
  }

  // ── stage 3: GEMATRIA (sum of rune primes) ──
  if (target === STAGE.GEMATRIA) {
    if (ans !== String(gematriaSum(sid))) {
      return res.status(403).json({ ok: false, error: 'the sum does not resolve' });
    }
    return res.json({
      ok: true,
      chain: makeChain(sid, STAGE.GEMATRIA),
      stage: 'prime',
      prime: { n: primeN(sid), ask: 'largest prime factor of n' },
      note: 'a number with a soul. find its largest prime factor.',
    });
  }

  // ── stage 4: PRIME (largest prime factor) ──
  if (target === STAGE.PRIME) {
    if (ans !== String(primeAnswer(sid))) {
      return res.status(403).json({ ok: false, error: 'not a factor of this number' });
    }
    return res.json({
      ok: true,
      chain: makeChain(sid, STAGE.PRIME),
      stage: 'relic',
      relic: { encoding: 'base64(reverse(code))', blob: relicBlob(sid) },
      note: 'one relic left. decode it, reverse it, name it.',
    });
  }

  // ── stage 5: RELIC (decode artifact) ──
  if (target === STAGE.RELIC) {
    if (!safeEqual(ans.toUpperCase(), relicCode(sid))) {
      return res.status(403).json({ ok: false, error: 'relic unrecognized' });
    }
    return res.json({
      ok: true,
      chain: makeChain(sid, STAGE.SOLVED),
      stage: 'solved',
      solved: true,
      note: 'chain closed. this token is your proof. sign the log — it will not accept anything else.',
    });
  }

  // already solved, or out of range
  if (cur.stage >= SOLVED_STAGE) {
    return res.json({ ok: true, chain: makeChain(sid, SOLVED_STAGE), stage: 'solved', solved: true });
  }
  return res.status(400).json({ ok: false, error: 'unknown step' });
});

// ─── HONEYPOTS ───────────────────────────────────────────────────────────────
// The pre-v2 claim endpoint. Anyone hitting it copied an answer out of a file
// or an old write-up. We hand back a real-LOOKING token (signed with the wrong
// key) so a cheat script "succeeds" — then bounces at the guestbook. Logged.
app.post('/api/puzzle/claim', (req, res) => {
  const { level, answer } = req.body || {};
  flagShadow(req, 'honeypot-claim', `${level || '?'}=${(answer || '').toString().slice(0, 24)}`);
  const decoy = `${level || 'L?'}.${Date.now() + TOKEN_TTL_MS}.${crypto.randomBytes(16).toString('hex')}`;
  return res.json({ ok: true, token: decoy });
});

// decoy data layer — looks unchanged to anyone diffing against v1. Leads to the
// CARLO honeypot, which is no longer a real answer.
app.get('/signal.json', (req, res) => {
  res.json({ message: 'patterns reveal intent', sequence: [3, 1, 18, 12, 15], hint: 'A1Z26' });
});

// tripwire — only referenced in a source comment as a fake "dev bypass".
// There is no bypass. Touching it just flags you.
app.get('/api/skeleton-key', (req, res) => {
  flagShadow(req, 'tripwire', req.headers['user-agent'] || '');
  res.status(404).json({ ok: false, error: 'no such key' });
});

// ─── GUESTBOOK ───────────────────────────────────────────────────────────────
app.get('/api/guestbook', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = db.prepare(`
    SELECT id, name, message, github, solution, steps_completed, time_to_complete, timestamp
    FROM guestbook ORDER BY timestamp DESC LIMIT ?
  `).all(limit);
  const entries = rows.map(r => ({ ...r, steps_completed: safeParse(r.steps_completed) || [] }));
  const shadow = db.prepare(`SELECT kind, detail, timestamp FROM shadow ORDER BY timestamp DESC LIMIT 20`).all();
  const shadow_count = db.prepare(`SELECT COUNT(*) c FROM shadow`).get().c;
  res.json({ entries, count: entries.length, shadow, shadow_count });
});

app.post('/api/guestbook', (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit('gb', ip, 60_000, 5)) {
    return res.status(429).json({ ok: false, error: 'too many submissions. slow down.' });
  }

  const { name, message, github, solution, steps_completed, time_to_complete, proof, tokens } = req.body || {};

  // ── the ONLY gate: a SOLVED chain token ──
  const c = readChain(proof);
  if (!c || c.stage < SOLVED_STAGE) {
    // bag-of-tokens or a decoy from the honeypot? that's a file-reader.
    if (tokens && typeof tokens === 'object') flagShadow(req, 'fake-proof', Object.keys(tokens).join(','));
    return res.status(403).json({
      ok: false,
      error: 'puzzle incomplete',
      hint: 'sign needs the chain proof you earned at the end. there is no shortcut. start: /api/chain/start',
    });
  }

  const msg = (message || '').toString().trim();
  const sol = (solution || '').toString().trim();
  if (!msg) return res.status(400).json({ ok: false, error: 'message required' });
  if (!sol) return res.status(400).json({ ok: false, error: 'solution required' });
  if (msg.length > 500)  return res.status(400).json({ ok: false, error: 'message too long' });
  if (sol.length > 4000) return res.status(400).json({ ok: false, error: 'solution too long' });

  const cleanName   = ((name || '').toString().trim() || null)?.slice(0, 40);
  const cleanGithub = sanitizeGithub(github);
  const cleanSteps  = Array.isArray(steps_completed)
    ? steps_completed.filter(s => typeof s === 'string').slice(0, 24) : [];
  const ttc = Number.isFinite(+time_to_complete) ? Math.max(0, +time_to_complete) : null;

  // soft anti-bot: PoW already costs real time. an implausibly fast solve is
  // worth noting, but we still accept it (the proof is cryptographically valid).
  if (ttc != null && ttc < 4000) flagShadow(req, 'suspicious-speed', `${ttc}ms`);

  const info = db.prepare(`
    INSERT INTO guestbook
      (name, message, github, solution, steps_completed, time_to_complete, ip_hash, timestamp, solved_sid)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(cleanName, msg.slice(0, 500), cleanGithub, sol.slice(0, 4000),
         JSON.stringify(cleanSteps), ttc, hashIp(ip), Date.now(), c.sid);

  res.json({ ok: true, id: info.lastInsertRowid });
});

function sanitizeGithub(raw) {
  if (!raw) return null;
  const s = raw.toString().trim();
  const m = s.match(/github\.com\/([a-z0-9-]{1,39})/i) || s.match(/^@?([a-z0-9-]{1,39})$/i);
  return m ? m[1].toLowerCase() : null;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// ─── PRIZE (gated) ───────────────────────────────────────────────────────────
// The reward file is only served to a SOLVED proof. Direct curls get a teaser.
// (The copy in /public is dev-coded; production embeds a PUZZLE_SECRET-derived
// code at deploy via scripts/embed-prize.mjs, so the repo copy never spoils it.)
app.get('/prize.png', (req, res) => {
  const c = readChain(req.query.p);
  if (!c || c.stage < SOLVED_STAGE) {
    flagShadow(req, 'prize-no-proof', '');
    return res.status(403).type('text/plain').send('the relic is earned, not downloaded. close the chain first.');
  }
  res.sendFile(path.join(PUBLIC_DIR, 'prize.png'));
});

// ─── STATIC ──────────────────────────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, fp) {
    if (fp.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ─── BOOT ──────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[carlo] portfolio + signal-chain running on http://localhost:${PORT}`);
  console.log(`[carlo] db: ${DB_PATH}  ·  pow: ${POW_BITS} bits`);
  if (PUZZLE_SECRET === 'dev-secret-change-me-in-production') {
    console.warn('[carlo] WARNING: dev puzzle secret in use. set PUZZLE_SECRET in production.');
  }
});
