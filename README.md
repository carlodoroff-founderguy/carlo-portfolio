# carlo-portfolio · puzzle + backend layer

Turns the existing single-file portfolio into:

- a layered puzzle system (6 levels, none signposted)
- a real guestbook with SQLite-backed API
- a behavior tracker that travels with each submission

Nothing existing is rewritten. All changes are additive diffs, documented in
[`INTEGRATION.md`](./INTEGRATION.md).

## Run

```bash
npm install
npm start
# open http://localhost:3000
```

Requires Node 18+. Dependencies: `express`, `better-sqlite3`. No build step.

## What's in this folder

```
server.js              — express app. 6 routes + static. SQLite opens on boot.
package.json           — minimal deps.
public/
  index.html           — ** copy your existing index.html here **, then apply
                         the patches in INTEGRATION.md
  rabbit.html          — /rabbit  (Level 1)
  cra-0004.html        — /cra-0004 (Level 2 + 3)
  signal.html          — /signal  (Level 5)
INTEGRATION.md         — exact diffs to apply to index.html
```

The three standalone HTML files (`rabbit`, `cra-0004`, `signal`) are already
styled to match the site's aesthetic — paper + ink, Big Shoulders Display,
JetBrains Mono, Fraunces for one italic accent, the SVG grain overlay.

## The flow

Read [`INTEGRATION.md`](./INTEGRATION.md) — it has a full flow diagram and a
verification checklist.

Short version:

1. Hero drops a throwaway hint.
2. Console tells you where to start.
3. `/rabbit` tells you to look for a gap.
4. The works catalog has a gap.
5. `/cra-0004` tells you (in source) to type a verb.
6. `SHIP` unlocks `/signal`.
7. `/signal.json` gives you a number sequence + cipher hint.
8. `CARLO` decodes; typing it fires the final overlay.
9. Overlay invites you to sign the guestbook — a real backend that stores
   your solution, github, and which steps you completed.

## Design principles (non-negotiable)

- No existing animation is degraded.
- No existing easter egg is removed (Konami, triple-click hero, `.hash`
  clicks, `SHIP`, rabbit-hole, DJ booth, secret booth — all preserved).
- No "game UI". No progress bars, no breadcrumbs, no "you unlocked".
- Everything reads as if it was always part of the site.

## Data

SQLite file: `guestbook.db` (created on first boot). Includes WAL journal.
Drop the file to reset. Safe to `.gitignore` — it is.

API:

```
GET  /api/guestbook?limit=100
POST /api/guestbook   { name?, message, github?, solution, steps_completed?, time_to_complete? }

GET  /signal.json     { message, sequence, hint }
GET  /rabbit | /cra-0004 | /signal   static html
GET  /*                any other path → index.html
```

Rate limit: 5 POSTs per minute per IP, in-process. Replace with a real
rate-limit middleware if you ever actually ship this.

## What to do next

- Drop your patched `index.html` into `public/`.
- `npm install && npm start`.
- Solve it yourself end to end — verification checklist in INTEGRATION.md.
- If something feels like a "game", make it more subtle.
