# carlo-portfolio · puzzle + backend layer

A portfolio site with a hidden, **server-authoritative** technical challenge —
the Signal Chain — and a real SQLite-backed guestbook gated on solving it.

The earlier version leaked: answers were hardcoded in `server.js`, tokens were
embedded in the served HTML, and `INTEGRATION.md` spelled out every step. People
read a file and "solved" it. v2 fixes that at the root.

## The design rule

**No answer, no token, and no plaintext solution lives in any file you can
read.** The source contains only machinery — HMAC keys, SHA-256 checks,
ciphertext, and per-session derivations keyed on `PUZZLE_SECRET`. Reading the
repo tells you *how the lock works*, not the combination. The combination is
different for every solver and is minted at runtime from a random session id.

There is one way through: do the work, in order, per session.

```
/gate  (the descent)  →  /signal  (the CRT terminal where you actually solve)

/api/chain/start
   → MINE      proof-of-work: grind a nonce, sha256(prefix:N) with N zero bits
   → DECRYPT   Vigenère burst, decrypted with the key you earned by mining
   → GEMATRIA  a rune sequence (Cicada Gematria Primus) — sum the runes' primes
   → PRIME     a per-session number — submit its largest prime factor
   → RELIC     decode the artifact (base64 + reverse)
   → SOLVED    one unforgeable proof token — the only thing the guestbook accepts
```

Five locks, in order. Everything is verified server-side; the browser does the
proof-of-work and the math, the server hands out nothing it didn't earn.
`/map` is a live star chart drawn from your own progress.

## Anti-cheat

- **Honeypots.** The pre-v2 surface (`SHIP` / `CARLO` / `/signal.json` /
  `/api/puzzle/claim`) is kept alive on purpose. Hitting it returns a
  real-looking token that the guestbook rejects — and logs you to the shadow
  wall.
- **Tripwire.** `/api/skeleton-key` is referenced only in a source comment as a
  fake "dev bypass." There is no bypass. Touching it flags you.
- **Shadow wall.** Every honeypot/tripwire/fake-proof hit is counted and shown
  publicly under the guestbook: *N tripped a honeypot trying to skip the chain.*

## Run

```bash
npm install        # express only — no native build, no compiler
npm start          # http://localhost:3000
```

Requires **Node 24+** (uses the built-in `node:sqlite`, unflagged from Node 24).
Pinned via `.node-version` / `.nvmrc` so PaaS builds pick a compatible runtime.

Useful env:

| var               | default                  | meaning                                  |
|-------------------|--------------------------|------------------------------------------|
| `PUZZLE_SECRET`   | `dev-secret-…`           | seeds every per-session secret. **Set in prod.** |
| `PUZZLE_POW_BITS` | `18`                     | proof-of-work difficulty (leading zero bits) |
| `PORT`            | `3000`                   | listen port                              |
| `DB_PATH`         | `./guestbook.db`         | SQLite file                              |

After setting a real `PUZZLE_SECRET`, regenerate the reward so its embedded code
isn't the dev one:

```bash
PUZZLE_SECRET=… npm run embed-prize
```

Reference solver / smoke test (drives the real client runner end-to-end and
checks the honeypot is rejected):

```bash
npm run solve            # against http://localhost:3000
```

## Files

```
server.js              express app + Signal Chain engine + guestbook. node:sqlite.
public/
  index.html           the portfolio (puzzle hooks: hero hint, console, eggs, guestbook)
  chain.js             client runner: sync SHA-256 miner, Vigenère, gematria, prime factor, relic
  gate.html            /gate — the cinematic descent / entry to the deep
  signal.html          /signal — the CRT terminal where you solve all five locks
  map.html             /map — live star chart of your descent (reads localStorage)
  rabbit.html          /rabbit — lore breadcrumb
  cra-0004.html        /cra-0004 — lore breadcrumb
  prize.png            the reward (code derived from PUZZLE_SECRET; this copy is dev-only)
scripts/
  embed-prize.mjs      (re)embed the prize payload with a PUZZLE_SECRET-derived code
  solve.mjs            reference solver + smoke test
  build-prize.py       original image generator (needs Pillow; optional)
INTEGRATION.md         architecture notes (no spoilers — there's nothing to spoil)
```

## Data

SQLite file `guestbook.db` (WAL). Drop it to reset. `.gitignore`d.

```
GET  /api/guestbook?limit=100   → { entries, count, shadow, shadow_count }
POST /api/guestbook             → requires { proof } (a SOLVED chain token) + message, solution
POST /api/chain/start           → { chain, pow:{prefix,bits} }
POST /api/chain/step            → { chain, answer } → advances one stage
GET  /prize.png?p=<proof>       → reward, gated on a SOLVED proof
```

Guestbook rate limit: 5 submissions / minute / IP. Chain: 90 requests / minute / IP.
Both are coarse and in-process — swap for real middleware before any serious traffic.
