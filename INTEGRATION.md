# Integration Guide — puzzle + backend over existing portfolio

Everything here is a minimal diff against the existing `index.html`. No file is
rewritten. All changes are additive except two tiny text edits (works header
count + hash numbers).

File layout after integration:

```
server.js
package.json
public/
  index.html            ← your existing file + patches below
  rabbit.html           ← already provided
  cra-0004.html         ← already provided
  signal.html           ← already provided
guestbook.db            ← created on first run
```

Run it:

```
npm install
npm start
# http://localhost:3000
```

---

## Flow (the filter, top to bottom)

```
hero has one thrown-away line ────────────────────────────┐
                                                          ↓
[L0] devtools open → existing console banner            subtle
     + 3 new lines ("curious. good." / "/rabbit")       trigger
                                                          ↓
[L1] /rabbit page            "find what's missing."
                                                          ↓
[L2] works section has 07 items listed but only 06      visitor
     tiles rendered. hash gap at 0004.                  infers
                                                          ↓
[L3] /cra-0004  page loads normally; HTML source        devtools
     contains a comment hinting at a keyboard verb.      viewer
                                                          ↓
[L4] typing SHIP anywhere  → existing SHIP IT flash
     + log that /signal is now live
     + persists unlock in localStorage
                                                          ↓
[L5] /signal  labels the data path → /signal.json
     returns { sequence:[3,1,18,12,15], hint:"A1Z26" }
     A1Z26 ⇒ C A R L O
                                                          ↓
[L6] typing CARLO  → overlay: "you made it. this wasn't
     a game. it was a filter."  → "build something.
     send what you made." → guestbook link.
                                                          ↓
     guestbook POSTs to /api/guestbook with:
       name, message, github, solution, steps_completed,
       time_to_complete (ms since first load)
     entries appear without refresh.
```

No visible levels. No "progress". No instructions. Only signals.

---

## Patch 1 — Entry hook in hero

**Where:** inside `<section class="hero">`, in the `.hero__tagline` block.

**Find:**

```html
<p class="hero__tagline">
  Co-founder &amp; CEO of Craze. Student at UMiami. Formerly Investment Banking Analyst at Curvature.<br>
  I ship before I'm ready. Then I fix it. <em>twice if I have to.</em>
</p>
```

**Replace with:**

```html
<p class="hero__tagline">
  Co-founder &amp; CEO of Craze. Student at UMiami. Formerly Investment Banking Analyst at Curvature.<br>
  I ship before I'm ready. Then I fix it. <em>twice if I have to.</em>
  <span class="hero__aside">there's also a technical challenge hidden in here.</span>
</p>
```

**Add CSS** near the `.hero__tagline` rule:

```css
.hero__aside {
  display: block;
  margin-top: 12px;
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
  opacity: 0.38;
  color: var(--ink);
}
.hero__aside::before {
  content: "// ";
  opacity: 0.5;
}
```

Rationale: reads like a throwaway comment. Low opacity, mono, prefaced with
`//` so it looks like leaked dev commentary. Intentional enough to register,
vague enough to ignore.

---

## Patch 2 — Works catalog inconsistency (Level 2)

Two edits in the `.works` section.

### 2a. Change the catalog counter

**Find:**

```html
<small>02 / built things · 06 total · hover to preview</small>
```

**Replace with:**

```html
<small>02 / built things · 06 shown · 07 catalogued · hover to preview</small>
```

### 2b. Renumber the hashes so `0004` is conspicuously missing

Only the `<span class="hash">…</span>` text changes. Everything else in each
`.work` anchor is untouched. Apply in order:

| Project         | Old hash          | New hash          |
|-----------------|-------------------|-------------------|
| Craze           | `#cra-0001 / 06`  | `#cra-0001 / 07`  |
| IB DD Automator | `#ibd-0002 / 06`  | `#cra-0002 / 07`  |
| Trend Engine    | `#ttk-0003 / 06`  | `#cra-0003 / 07`  |
| @carlodavis_    | `#cdv-0004 / 06`  | `#cra-0005 / 07`  |
| Roommate Finder | `#umr-0005 / 06`  | `#cra-0006 / 07`  |
| $107k Summer    | `#esd-0006 / 06`  | `#cra-0007 / 07`  |

Visitor scans `cra-0001, 0002, 0003, 0005, 0006, 0007` with "07 catalogued" in
the header. The gap at `0004` is inferable. `/cra-0004` is the route.

(Optional; keeps existing hash egg working unchanged because the Egg 3 handler
binds to any `.hash` element.)

---

## Patch 3 — Level 0 console extension

**Where:** inside the existing `// ─── Egg 1: console greeting ───` IIFE,
immediately after the last `console.log(...)` and before the closing `})();`.

**DO NOT** remove anything above. Just append:

```js
  // puzzle signal — low key
  console.log('%c  · curious. good.', dim);
  console.log('%c  · there is more here than you think.', dim);
  console.log('%c  · start where most people do not look.', dim);
  console.log('%c  /rabbit', 'color:#8EE000;font-family:monospace;font-size:12px;padding:2px 0;');
```

---

## Patch 4 — Behavior tracker (shared state)

**Where:** add a new IIFE near the top of the `<script type="module">` block,
just before the `// ─── MOTION CONFIG ───` comment. Everything else can read
from `window.__puzzle`.

```js
// ─── BEHAVIOR TRACKING ───────────────────────────────────────────────────
// a tiny state machine in localStorage. each puzzle step writes a timestamp.
// read on guestbook submit; sent as steps_completed + time_to_complete.
const PUZZLE_KEY = 'cd_puzzle_state_v1';
window.__puzzle = (() => {
  const load  = () => { try { return JSON.parse(localStorage.getItem(PUZZLE_KEY) || '{}'); } catch { return {}; } };
  const save  = (s) => { try { localStorage.setItem(PUZZLE_KEY, JSON.stringify(s)); } catch {} };
  const state = load();
  if (!state.started_at) state.started_at = Date.now();
  state.steps_completed = state.steps_completed || [];
  save(state);

  const mark = (key) => {
    const s = load();
    if (!s.started_at) s.started_at = Date.now();
    s.steps_completed = s.steps_completed || [];
    if (!s.steps_completed.includes(key)) s.steps_completed.push(key);
    s[key.toLowerCase() + '_at'] = s[key.toLowerCase() + '_at'] || Date.now();
    save(s);
    return s;
  };
  const get  = () => load();
  const time = () => {
    const s = load();
    return s.started_at ? Date.now() - s.started_at : null;
  };
  return { mark, get, time };
})();
```

(The three standalone puzzle pages — `rabbit.html`, `cra-0004.html`,
`signal.html` — already write their own `L1/L2/L5` marks with the same
localStorage key, so progress is preserved cross-page.)

---

## Patch 5 — Extend the SHIP trigger (Level 4)

**Where:** inside the existing `// ─── Egg 2: type "SHIP" anywhere ──` IIFE.
Find the `if (buf === SECRET)` branch:

```js
if (buf === SECRET) {
  flashShipIt();
  buf = '';
}
```

**Replace with:**

```js
if (buf === SECRET) {
  flashShipIt();
  // Level 4 unlock
  window.__puzzle && window.__puzzle.mark('L4_ship');
  if (!window.__signalUnlocked) {
    window.__signalUnlocked = true;
    console.log('%c  /signal  is live.',
      'color:#8EE000;background:#0F0E0C;padding:4px 10px;font-family:monospace;font-size:12px;');
  }
  // inject a hidden DOM breadcrumb — findable in devtools, not visible
  if (!document.getElementById('signal-breadcrumb')) {
    const b = document.createElement('a');
    b.id = 'signal-breadcrumb';
    b.href = '/signal';
    b.rel = 'next';
    b.setAttribute('aria-hidden', 'true');
    b.textContent = '/signal';
    b.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(b);
  }
  buf = '';
}
```

---

## Patch 6 — Level 6: CARLO trigger + final overlay

**Where:** add a new IIFE at the bottom of the `<script type="module">` block,
after `Egg 4` and before `// ─── INITIAL KICK ───`.

Also add two small pieces of markup and one CSS block.

### 6a. Overlay markup

Add at the very end of `<body>`, just before the closing `</body>` tag, **after**
the existing `<svg class="side-wave …">` elements:

```html
<!-- Level 6 overlay — only rendered when CARLO is typed -->
<div class="filter-overlay" id="filter-overlay" aria-hidden="true" role="dialog" aria-label="End of filter">
  <div class="filter-overlay__inner">
    <div class="filter-overlay__crumb">06 / 06 · end of signal</div>
    <h2 class="filter-overlay__title">You made it.</h2>
    <p class="filter-overlay__body">
      This wasn't a game.<br>It was a <em>filter.</em>
    </p>
    <p class="filter-overlay__cta">
      If you made it this far, build something.<br>
      Add to this. Break it. Improve it.<br>
      <em>Send what you made.</em>
    </p>
    <div class="filter-overlay__actions">
      <button type="button" class="filter-overlay__btn" data-filter-sign>sign the log</button>
      <button type="button" class="filter-overlay__btn filter-overlay__btn--ghost" data-filter-close>dismiss</button>
    </div>
    <div class="filter-overlay__meta" id="filter-overlay-meta"></div>
  </div>
</div>
```

### 6b. Overlay CSS

Add near the bottom of the `<style>` block (before `@media (prefers-reduced-motion)`):

```css
/* ══════════════════════════════════════════════════════════════════════════
   LEVEL 6 — FILTER OVERLAY
   black/paper. minimal. no flashy UI.
   ══════════════════════════════════════════════════════════════════════════ */
.filter-overlay {
  position: fixed; inset: 0;
  background: var(--ink);
  color: var(--paper);
  z-index: 10500;
  display: grid; place-items: center;
  padding: var(--gutter);
  opacity: 0; pointer-events: none;
  transition: opacity 500ms var(--ease-out);
}
.filter-overlay.is-open { opacity: 1; pointer-events: auto; }
.filter-overlay__inner {
  max-width: 640px; width: 100%;
  display: grid; gap: 28px;
  text-align: left;
}
.filter-overlay__crumb {
  font-family: var(--f-mono);
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  opacity: 0.4;
}
.filter-overlay__title {
  font-family: var(--f-display); font-weight: 900;
  font-size: clamp(56px, 9vw, 140px);
  line-height: 0.88; letter-spacing: -0.04em;
  text-transform: uppercase;
  color: var(--paper);
}
.filter-overlay__body {
  font-family: var(--f-display); font-weight: 700;
  font-size: clamp(22px, 2.6vw, 34px);
  line-height: 1.15; letter-spacing: -0.02em;
  text-transform: uppercase;
}
.filter-overlay__body em,
.filter-overlay__cta em {
  font-family: var(--f-editorial);
  font-style: italic; font-weight: 400;
  color: var(--primary);
  text-transform: none;
  letter-spacing: -0.01em;
}
.filter-overlay__cta {
  font-family: var(--f-mono);
  font-size: 14px; line-height: 1.7;
  opacity: 0.85; max-width: 52ch;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--paper) 15%, transparent);
}
.filter-overlay__actions {
  display: flex; gap: 12px; flex-wrap: wrap; padding-top: 8px;
}
.filter-overlay__btn {
  padding: 14px 20px;
  border: 1px solid var(--paper);
  font-family: var(--f-mono);
  font-size: 12px;
  letter-spacing: 0.14em; text-transform: uppercase;
  background: transparent; color: var(--paper);
  cursor: pointer;
  transition: background 200ms var(--ease-out), color 200ms var(--ease-out);
}
.filter-overlay__btn:hover { background: var(--paper); color: var(--ink); }
.filter-overlay__btn--ghost { border-color: color-mix(in srgb, var(--paper) 30%, transparent); }
.filter-overlay__meta {
  font-family: var(--f-mono);
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  opacity: 0.35;
  padding-top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .filter-overlay { transition: none; }
}
```

### 6c. CARLO keyboard handler + overlay controller

Add this IIFE after Egg 4:

```js
// ─── Egg 5 / Level 6: type CARLO → final overlay ─────────────────────────
(() => {
  const CODE = 'CARLO';
  let buf = '';
  const overlay = document.getElementById('filter-overlay');
  const meta    = document.getElementById('filter-overlay-meta');

  function open() {
    if (!overlay) return;
    window.__puzzle && window.__puzzle.mark('L6_carlo');
    // populate meta: how many steps, how long it took
    const st = window.__puzzle ? window.__puzzle.get() : {};
    const steps = (st.steps_completed || []).length;
    const elapsed = window.__puzzle && window.__puzzle.time();
    if (meta) {
      meta.textContent = steps + ' / 06 steps · '
        + (elapsed ? (elapsed / 1000 / 60).toFixed(1) + ' minutes' : '');
    }
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }
  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = (e.key || '').toUpperCase();
    if (k.length === 1 && k >= 'A' && k <= 'Z') {
      buf = (buf + k).slice(-CODE.length);
      if (buf === CODE) { open(); buf = ''; }
    }
  });

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay?.querySelector('[data-filter-close]')
    ?.addEventListener('click', close);
  overlay?.querySelector('[data-filter-sign]')
    ?.addEventListener('click', () => {
      close();
      // ensure guestbook is visible even without konami
      document.body.classList.add('konami', 'filter-passed');
      // wait a frame so the now-visible guestbook has a real offsetTop
      requestAnimationFrame(() => {
        const gb = document.getElementById('guestbook-real');
        if (!gb) return;
        if (window.lenis) window.lenis.scrollTo(gb, { offset: -60 });
        else gb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
```

---

## Patch 7 — Guestbook: real backend + extended form

Two changes: markup (new fields, list container gets a real id) and JS (fetch
from API on load, POST on submit, enrich with behavior data).

### 7a. Replace the existing `.guestbook` block in the colophon

**Find** the block that starts with:

```html
<div class="guestbook" aria-label="Guestbook (konami unlocked)">
```

…through its matching `</div>`.

**Replace with:**

```html
<div class="guestbook" id="guestbook-real" aria-label="Guestbook">
  <h4>Guestbook · <span class="guestbook__subtitle">log of everyone who made it through</span></h4>
  <ul class="guestbook__list" id="gb-list" aria-live="polite"></ul>
  <form class="guestbook__form" id="gb-form" autocomplete="off">
    <input  id="gb-name"     name="name"     maxlength="40"   placeholder="handle (optional)">
    <input  id="gb-github"   name="github"   maxlength="80"   placeholder="github (optional)">
    <input  id="gb-msg"      name="message"  maxlength="120"  placeholder="leave something nice" required>
    <textarea id="gb-solution" name="solution" maxlength="4000" rows="3"
              placeholder="how did you solve it?" required></textarea>
    <button id="gb-submit" type="submit">sign</button>
    <div class="guestbook__status" id="gb-status" aria-live="polite"></div>
  </form>
</div>
```

Notes:
- Real form element → native validation + enter-to-submit.
- Renamed `#gb-form` replaces the old click-on-button flow.
- `aria-live="polite"` on the list so new entries announce.
- Kept the `.guestbook` class so the konami gate still works for users who go
  that route. `body.filter-passed .guestbook { display: block; }` forces it
  open after Level 6.

### 7b. Guestbook CSS additions

Add after the existing `.guestbook__form` rules:

```css
body.filter-passed .guestbook { display: block; }
.guestbook__subtitle {
  opacity: 0.55; font-weight: 400; text-transform: none; letter-spacing: 0.04em; color: var(--paper);
  font-size: 10px; margin-left: 6px;
}
.guestbook__form {
  grid-template-columns: 1fr 1fr 2fr auto;
  grid-auto-rows: auto;
  grid-template-areas:
    "name github msg msg"
    "sol  sol    sol submit"
    "stat stat   stat stat";
}
#gb-name     { grid-area: name; }
#gb-github   { grid-area: github; }
#gb-msg      { grid-area: msg; }
#gb-solution { grid-area: sol; resize: vertical; min-height: 72px; }
#gb-submit   { grid-area: submit; align-self: stretch; }
.guestbook__status { grid-area: stat; font-size: 10px; letter-spacing: 0.08em; opacity: 0.6; padding-top: 4px; }
.guestbook__form textarea {
  padding: 10px 12px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--paper) 20%, transparent);
  color: var(--paper);
  font-family: var(--f-mono); font-size: 11px; line-height: 1.5;
}
.guestbook__form textarea:focus,
.guestbook__form input:focus { outline: none; border-color: var(--signal); }

.guestbook__list li.is-high-signal {
  border-left: 2px solid var(--signal);
  padding-left: 8px;
}
.guestbook__list li .gb-sol {
  display: block; opacity: 0.55;
  margin-top: 4px; padding-left: 10px;
  border-left: 1px solid color-mix(in srgb, var(--paper) 15%, transparent);
  white-space: pre-wrap;
}
.guestbook__list li .gb-gh { opacity: 0.4; margin-left: 6px; font-size: 10px; }
.guestbook__list li .gb-steps { opacity: 0.35; font-size: 9px; letter-spacing: 0.18em; margin-left: 8px; }

@media (max-width: 640px) {
  .guestbook__form {
    grid-template-columns: 1fr;
    grid-template-areas: "name" "github" "msg" "sol" "submit" "stat";
  }
}
```

### 7c. Guestbook JS — replace the existing submit handler

**Find** the existing block inside the konami IIFE:

```js
// guestbook form
$('#gb-submit')?.addEventListener('click', () => {
  const name = $('#gb-name').value.trim() || 'anon';
  const msg  = $('#gb-msg').value.trim();
  if (!msg) return;
  const li = document.createElement('li');
  li.innerHTML = `<b>${name}</b>${msg}`;
  $('#gb-list').prepend(li);
  $('#gb-name').value = '';
  $('#gb-msg').value = '';
});
```

**Replace with:**

```js
// guestbook — talks to /api/guestbook. local state travels with submission.
(() => {
  const form   = document.getElementById('gb-form');
  const list   = document.getElementById('gb-list');
  const status = document.getElementById('gb-status');
  if (!form || !list) return;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const fmtTime = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2,'0');
    return pad(d.getMonth()+1) + '/' + pad(d.getDate())
         + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  const renderOne = (e) => {
    const li = document.createElement('li');
    const highSignal = (e.solution || '').length >= 200 || (e.steps_completed || []).length >= 5;
    if (highSignal) li.classList.add('is-high-signal');
    const nm = esc(e.name || 'anon');
    const gh = e.github ? ` <span class="gb-gh">↗ ${esc(e.github)}</span>` : '';
    const stepsN = (e.steps_completed || []).length;
    const steps = stepsN ? ` <span class="gb-steps">${stepsN}/6</span>` : '';
    const ts = ` <span class="gb-gh">${fmtTime(e.timestamp)}</span>`;
    const sol = e.solution ? `<span class="gb-sol">${esc(e.solution)}</span>` : '';
    li.innerHTML = `<b>${nm}</b>${esc(e.message || '')}${gh}${steps}${ts}${sol}`;
    return li;
  };

  async function refresh() {
    try {
      const r = await fetch('/api/guestbook?limit=100', { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('fetch failed');
      const data = await r.json();
      list.innerHTML = '';
      (data.entries || []).forEach((e) => list.appendChild(renderOne(e)));
    } catch (err) {
      // leave any optimistic entries in place
    }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name:     (fd.get('name')     || '').toString().trim(),
      github:   (fd.get('github')   || '').toString().trim(),
      message:  (fd.get('message')  || '').toString().trim(),
      solution: (fd.get('solution') || '').toString().trim(),
      steps_completed: (window.__puzzle?.get().steps_completed) || [],
      time_to_complete: window.__puzzle?.time() ?? null,
    };
    if (!payload.message || !payload.solution) {
      status.textContent = 'message + solution required.';
      return;
    }
    status.textContent = 'signing…';

    // optimistic prepend
    const optimistic = renderOne({ ...payload, timestamp: Date.now() });
    optimistic.style.opacity = '0.5';
    list.prepend(optimistic);

    try {
      const r = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        throw new Error(data.error || 'submit failed');
      }
      status.textContent = 'signed.';
      form.reset();
      await refresh();
      setTimeout(() => { status.textContent = ''; }, 2500);
    } catch (err) {
      optimistic.remove();
      status.textContent = '· ' + (err.message || 'error');
    }
  });

  // initial load; refresh every 20s while the guestbook is in view
  refresh();
  if ('IntersectionObserver' in window) {
    let timer = null;
    const gb = document.getElementById('guestbook-real');
    new IntersectionObserver((entries) => {
      const vis = entries[0].isIntersecting;
      if (vis && !timer) timer = setInterval(refresh, 20_000);
      else if (!vis && timer) { clearInterval(timer); timer = null; }
    }).observe(gb);
  }
})();
```

---

## Patch 8 — expose `lenis` globally (tiny)

Inside `startScroll()`, right after `lenis = new Lenis({ … });`, add:

```js
window.lenis = lenis;
```

This lets the overlay's "sign the log" button scroll smoothly to the guestbook.
Optional; without it, the code falls back to `scrollIntoView`.

---

## Verification checklist (do this before shipping)

1. `npm install && npm start` → visit `http://localhost:3000`.
2. Hero shows the subtle `// there's also a technical challenge hidden in here.` line.
3. Open devtools → console shows extended greeting ending with `/rabbit`.
4. Visit `/rabbit` → page loads, localStorage has `L1_rabbit` in `cd_puzzle_state_v1.steps_completed`.
5. Back on main site, works section reads `06 shown · 07 catalogued`. Hashes are `cra-0001, 0002, 0003, [gap], 0005, 0006, 0007`.
6. Visit `/cra-0004` → page renders. View source → HTML comment block references "four letters, imperative mood". L2 mark saved.
7. Type `SHIP` anywhere (not in an input) → existing red "SHIP IT" flash still fires. Console now prints `/signal is live.`. `document.getElementById('signal-breadcrumb')` exists. L4 marked.
8. Visit `/signal` → minimal page. Click/visit `/signal.json` → `{"message":"patterns reveal intent","sequence":[3,1,18,12,15],"hint":"A1Z26"}`. Decode: 3=C, 1=A, 18=R, 12=L, 15=O.
9. Type `CARLO` → overlay fades in, black background, paper text, "You made it." L6 marked.
10. Click "sign the log" → overlay closes, page scrolls to guestbook (now visible even without Konami).
11. Submit: leave `message` + `solution` filled. Entry appears without refresh, `steps_completed` count shown, high-signal (200+ char solution OR 5+ steps) gets the lime side-stripe.
12. Refresh the page: your entry is still there (SQLite persisted).
13. `curl http://localhost:3000/api/guestbook` returns JSON.
14. Konami code still works (existing Easter egg untouched).
15. Triple-click hero name still glitches (existing Easter egg untouched).
16. Audio booth + secret booth + scroll masterpiece untouched visually.

---

## Schema

```sql
CREATE TABLE guestbook (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT,
  message            TEXT NOT NULL,
  github             TEXT,
  solution           TEXT NOT NULL,
  steps_completed    TEXT,                   -- JSON array
  time_to_complete   INTEGER,                -- ms
  ip_hash            TEXT,                   -- for rate-limit bucketing
  timestamp          INTEGER NOT NULL        -- unix ms
);
```

`GET /api/guestbook?limit=100` → `{ entries: [...], count }`
`POST /api/guestbook` body: `{ name?, message, github?, solution, steps_completed?, time_to_complete? }`

Rate limit: 5 submissions per minute per IP (coarse, in-process, best-effort).

---

## What's native, what's additive

| Change | Type |
|---|---|
| Hero aside line | Additive (1 span, 1 CSS rule) |
| Works counter + hash renumbering | Text-only, no UI redesign |
| Console lines | Appended to existing IIFE |
| SHIP handler | Extended, not replaced — existing "SHIP IT" flash intact |
| CARLO overlay | New, isolated — no existing selector collides |
| Guestbook | Form extended; list renders from API; old konami gate preserved |
| Behavior tracker | New IIFE; reads its own localStorage key |
| `/rabbit`, `/cra-0004`, `/signal`, `/signal.json` | Separate files/endpoints; don't touch index.html |

Nothing existing is deleted. Every easter egg (Konami, triple-click,
hash-click, `SHIP`, rabbit-hole, secret-booth) continues to work unchanged.
