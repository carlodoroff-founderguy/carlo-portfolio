// patch.mjs — applies the 8 puzzle patches to your original index.html
// usage: node patch.mjs <path-to-original-index.html>
// output: writes to ./public/index.html

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const srcPath = process.argv[2];
if (!srcPath) {
  console.error('usage: node patch.mjs <path-to-original-index.html>');
  process.exit(1);
}

let html = readFileSync(resolve(srcPath), 'utf8');
const report = [];

function patch(name, find, replace) {
  if (!html.includes(find)) {
    console.error(`\n[FAIL] patch "${name}" — anchor not found:`);
    console.error(find.slice(0, 160) + (find.length > 160 ? '…' : ''));
    process.exit(2);
  }
  html = html.replace(find, replace);
  report.push(`  [ok] ${name}`);
}

// ──────────────────────────────────────────────────────────────────────────
// PATCH 1 — hero entry hook (CSS + markup)
// ──────────────────────────────────────────────────────────────────────────
patch('1a · hero__aside CSS',
  '.hero__scrollcue {',
  `.hero__aside {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  opacity: 0.38;
  margin-top: 6px;
  display: block;
  max-width: 44ch;
  line-height: 1.5;
}
.hero__aside::before { content: "// "; opacity: 0.55; }
.hero__scrollcue {`);

patch('1b · hero__aside markup',
  `      <span class="hero__scrollcue" aria-hidden="true">Scroll · or don't · I'm not your dad</span>`,
  `      <span class="hero__scrollcue" aria-hidden="true">Scroll · or don't · I'm not your dad</span>
    </div>
    <span class="hero__aside">there's also a technical challenge hidden in here.</span>
    <div style="display:none" aria-hidden="true">`);

// close the stray opened div from patch 1b at the end of hero
patch('1c · close stray wrapper',
  `  </section>

  <!-- ════════════════ MANIFESTO ════════════════ -->`,
  `    </div>
  </section>

  <!-- ════════════════ MANIFESTO ════════════════ -->`);

// ──────────────────────────────────────────────────────────────────────────
// PATCH 2 — works catalog: renumber to cra-XXXX, skip 0004, /07 total
// ──────────────────────────────────────────────────────────────────────────
patch('2a · works counter',
  '<small>02 / built things · 06 total · hover to preview</small>',
  '<small>02 / built things · 06 shown · 07 catalogued · hover to preview</small>');

patch('2b · hash cra-0001', '#cra-0001 / 06', '#cra-0001 / 07');
patch('2c · hash ibd-0002', '#ibd-0002 / 06', '#cra-0002 / 07');
patch('2d · hash ttk-0003', '#ttk-0003 / 06', '#cra-0003 / 07');
patch('2e · hash cdv-0004', '#cdv-0004 / 06', '#cra-0005 / 07');
patch('2f · hash umr-0005', '#umr-0005 / 06', '#cra-0006 / 07');
patch('2g · hash esd-0006', '#esd-0006 / 06', '#cra-0007 / 07');

// ──────────────────────────────────────────────────────────────────────────
// PATCH 4 — behavior tracker (inject near top of main module script)
// ──────────────────────────────────────────────────────────────────────────
patch('4 · puzzle state tracker',
  `// ─── MOTION CONFIG ───────────────────────────────────────────────────────`,
  `// ─── PUZZLE STATE TRACKER ────────────────────────────────────────────────
(() => {
  const KEY = 'cd_puzzle_state_v1';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };
  const state = read();
  if (!state.started_at) { state.started_at = Date.now(); write(state); }
  if (!state.steps_completed) { state.steps_completed = []; write(state); }
  if (!state.tokens) { state.tokens = {}; write(state); }
  window.__puzzle = {
    mark(key) {
      const s = read();
      if (!s.steps_completed) s.steps_completed = [];
      if (!s.steps_completed.includes(key)) {
        s.steps_completed.push(key);
        if (key === 'L6_carlo' && !s.completed_at) s.completed_at = Date.now();
        write(s);
      }
      return s;
    },
    async claim(level, answer) {
      try {
        const r = await fetch('/api/puzzle/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, answer }),
        });
        if (!r.ok) return null;
        const data = await r.json();
        if (data && data.ok && data.token) {
          const s = read();
          s.tokens = s.tokens || {};
          s.tokens[level] = data.token;
          write(s);
          return data.token;
        }
      } catch {}
      return null;
    },
    get() { return read(); },
    time() {
      const s = read();
      if (!s.started_at) return 0;
      return (s.completed_at || Date.now()) - s.started_at;
    },
    reset() { localStorage.removeItem(KEY); },
  };
})();

// ─── MOTION CONFIG ───────────────────────────────────────────────────────`);

// ──────────────────────────────────────────────────────────────────────────
// PATCH 8 — expose lenis for the CARLO overlay scroll-to-guestbook
// ──────────────────────────────────────────────────────────────────────────
patch('8 · expose lenis',
  `  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);`,
  `  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  window.lenis = lenis;`);

// ──────────────────────────────────────────────────────────────────────────
// PATCH 3 — extend Egg 1 console output with /rabbit hint
// ──────────────────────────────────────────────────────────────────────────
patch('3 · console /rabbit hint',
  `  console.log('%c  · scroll past the footer. keep going.', dim);
})();`,
  `  console.log('%c  · scroll past the footer. keep going.', dim);
  console.log('%c', dim);
  console.log('%c  there\\'s also something else buried here.', dim);
  console.log('%c  start: /rabbit', dim);
})();`);

// ──────────────────────────────────────────────────────────────────────────
// PATCH 5 — extend SHIP trigger (mark + /signal breadcrumb)
// ──────────────────────────────────────────────────────────────────────────
patch('5 · SHIP extension',
  `      if (buf === SECRET) {
        flashShipIt();
        buf = '';
      }`,
  `      if (buf === SECRET) {
        flashShipIt();
        buf = '';
        if (window.__puzzle) {
          window.__puzzle.mark('L4_ship');
          window.__puzzle.claim('L4_ship', 'SHIP');
        }
        console.log('%c  next: /signal', 'color:#888;font-family:monospace;font-size:11px;');
      }`);

// inject the hidden breadcrumb anchor right before </body>
patch('5b · hidden breadcrumb',
  `</body>
</html>`,
  `<a id="signal-breadcrumb" href="/signal" style="position:absolute;left:-9999px;top:-9999px;opacity:0" aria-hidden="true" tabindex="-1">signal</a>

<!-- ══════════════════════════════════════════════════════════════════════════
     FILTER OVERLAY (level 6 — triggered by typing CARLO)
     ══════════════════════════════════════════════════════════════════════════ -->
<div id="filter-overlay" aria-hidden="true">
  <div class="filter-overlay__inner">
    <h2 class="filter-overlay__title">You made it.</h2>
    <p class="filter-overlay__body">
      This wasn't a game.<br>
      It was a <em>filter</em>.
    </p>
    <p class="filter-overlay__cta">
      build something. send what you made.<br>
      <button type="button" id="filter-sign-btn" class="filter-overlay__btn">sign the log →</button>
    </p>
  </div>
</div>
<style>
  #filter-overlay {
    position: fixed; inset: 0;
    background: #0F0E0C;
    color: #ECE6D7;
    display: grid;
    place-items: center;
    padding: 8vh 8vw;
    z-index: 9998;
    opacity: 0;
    pointer-events: none;
    transition: opacity 800ms cubic-bezier(.16,1,.3,1);
  }
  #filter-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .filter-overlay__inner {
    max-width: 720px;
    text-align: left;
  }
  .filter-overlay__title {
    font-family: "Big Shoulders Display", sans-serif;
    font-weight: 900;
    font-size: clamp(64px, 12vw, 180px);
    line-height: 0.85;
    letter-spacing: -0.04em;
    text-transform: uppercase;
    margin-bottom: 40px;
  }
  .filter-overlay__body {
    font-family: "Big Shoulders Display", sans-serif;
    font-weight: 700;
    font-size: clamp(28px, 4.5vw, 56px);
    line-height: 1.1;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    margin-bottom: 48px;
  }
  .filter-overlay__body em {
    font-family: "Fraunces", serif;
    font-style: italic;
    font-weight: 400;
    color: #E63E21;
    text-transform: none;
  }
  .filter-overlay__cta {
    font-family: "JetBrains Mono", monospace;
    font-size: 13px;
    letter-spacing: 0.04em;
    opacity: 0.75;
    line-height: 1.8;
  }
  .filter-overlay__btn {
    margin-top: 16px;
    padding: 14px 22px;
    background: transparent;
    border: 1px solid #8EE000;
    color: #8EE000;
    font-family: inherit;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 240ms, color 240ms;
  }
  .filter-overlay__btn:hover {
    background: #8EE000;
    color: #0F0E0C;
  }
  body.filter-passed .guestbook { display: block !important; }
</style>
<script>
// CARLO trigger — types "CARLO" anywhere to reveal filter overlay
(() => {
  const SECRET = 'CARLO';
  let buf = '';
  const overlay = document.getElementById('filter-overlay');
  const signBtn = document.getElementById('filter-sign-btn');

  addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = (e.key || '').toUpperCase();
    if (k.length === 1 && k >= 'A' && k <= 'Z') {
      buf = (buf + k).slice(-SECRET.length);
      if (buf === SECRET) {
        overlay.classList.add('visible');
        document.body.classList.add('filter-passed');
        if (window.__puzzle) {
          window.__puzzle.mark('L6_carlo');
          window.__puzzle.claim('L6_carlo', 'CARLO');
        }
        buf = '';
      }
    }
  });

  if (signBtn) signBtn.addEventListener('click', () => {
    overlay.classList.remove('visible');
    requestAnimationFrame(() => {
      const gb = document.querySelector('.guestbook');
      if (!gb) return;
      if (window.lenis) {
        window.lenis.scrollTo(gb, { offset: -40 });
      } else {
        gb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
</script>
</body>
</html>`);

// ──────────────────────────────────────────────────────────────────────────
// PATCH 7 — guestbook: extend form + switch to /api/guestbook backend
// ──────────────────────────────────────────────────────────────────────────
patch('7a · guestbook markup',
  `    <div class="guestbook" aria-label="Guestbook (konami unlocked)">
      <h4>Guestbook · you found the konami code</h4>
      <ul class="guestbook__list" id="gb-list">
        <li><b>carlo</b>first entry. hi from 2026.</li>
        <li><b>anonymous</b>the cursor is sick</li>
        <li><b>someone</b>the counterweight hit harder than i expected</li>
      </ul>
      <div class="guestbook__form">
        <input id="gb-name" maxlength="16" placeholder="handle">
        <input id="gb-msg" maxlength="80" placeholder="leave something nice">
        <button id="gb-submit">sign</button>
      </div>
    </div>`,
  `    <div class="guestbook" id="guestbook-real" aria-label="Guestbook">
      <h4>Guestbook · sign the log</h4>
      <ul class="guestbook__list" id="gb-list"></ul>
      <div class="guestbook__form">
        <input id="gb-name" maxlength="24" placeholder="handle (optional)">
        <input id="gb-github" maxlength="40" placeholder="github (optional)">
        <input id="gb-msg" maxlength="120" placeholder="leave something nice" required>
        <textarea id="gb-solution" maxlength="4000" rows="3" placeholder="tell me what you built to get here. the more specific the better." required></textarea>
        <button id="gb-submit">send</button>
      </div>
      <style>
        .guestbook__form { grid-template-columns: 1fr; gap: 10px; }
        .guestbook__form textarea {
          padding: 10px; background: transparent;
          border: 1px solid color-mix(in srgb, var(--paper) 20%, transparent);
          color: var(--paper); font-family: var(--f-mono); font-size: 12px;
          line-height: 1.5; resize: vertical; min-height: 72px;
        }
        .guestbook__form textarea:focus { outline: none; border-color: var(--signal); }
        .gb-entry--signal { border-left: 2px solid var(--signal); padding-left: 10px !important; }
        .gb-entry__meta { opacity: 0.5; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 4px; }
        .gb-prize { margin-top: 24px; padding: 18px; border: 1px dashed color-mix(in srgb, var(--signal) 50%, transparent); font-family: var(--f-mono); font-size: 12px; line-height: 1.7; color: var(--paper); }
        .gb-prize p + p { margin-top: 8px; }
        .gb-prize a { color: var(--signal); border-bottom: 1px solid currentColor; }
      </style>
    </div>`);

patch('7b · guestbook submit handler',
  `  // guestbook form
  $('#gb-submit')?.addEventListener('click', () => {
    const name = $('#gb-name').value.trim() || 'anon';
    const msg  = $('#gb-msg').value.trim();
    if (!msg) return;
    const li = document.createElement('li');
    li.innerHTML = \`<b>\${name}</b>\${msg}\`;
    $('#gb-list').prepend(li);
    $('#gb-name').value = '';
    $('#gb-msg').value = '';
  });`,
  `  // guestbook form — posts to /api/guestbook
  const gbEscape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const gbRender = (entries) => {
    const list = $('#gb-list');
    if (!list) return;
    list.innerHTML = '';
    entries.forEach(e => {
      const solLen = (e.solution || '').length;
      const steps = e.steps_completed ? e.steps_completed.length : 0;
      const isSignal = solLen >= 200 || steps >= 5;
      const li = document.createElement('li');
      if (isSignal) li.className = 'gb-entry--signal';
      const gh = e.github ? ' · @' + gbEscape(e.github) : '';
      const meta = steps ? \`<div class="gb-entry__meta">\${steps} steps · \${Math.round((e.time_to_complete||0)/1000)}s\${gh}</div>\` : (e.github ? \`<div class="gb-entry__meta">@\${gbEscape(e.github)}</div>\` : '');
      li.innerHTML = \`<b>\${gbEscape(e.name || 'anon')}</b>\${gbEscape(e.message || '')}\${meta}\`;
      list.appendChild(li);
    });
  };
  const gbFetch = async () => {
    try {
      const r = await fetch('/api/guestbook?limit=50');
      if (!r.ok) return;
      const data = await r.json();
      gbRender(data);
    } catch {}
  };
  $('#gb-submit')?.addEventListener('click', async () => {
    const name = $('#gb-name').value.trim();
    const github = $('#gb-github').value.trim();
    const msg = $('#gb-msg').value.trim();
    const sol = $('#gb-solution').value.trim();
    if (!msg || !sol) return;
    const state = window.__puzzle ? window.__puzzle.get() : {};
    const body = {
      name: name || null,
      github: github || null,
      message: msg,
      solution: sol,
      steps_completed: state.steps_completed || [],
      time_to_complete: window.__puzzle ? window.__puzzle.time() : 0,
      tokens: state.tokens || {},
    };
    try {
      const r = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        let reason = 'guestbook error: ' + r.status;
        try {
          const err = await r.json();
          if (err && err.error) reason = err.error + (err.missing_levels ? ' · missing: ' + err.missing_levels.join(', ') : '');
        } catch {}
        alert(reason);
        return;
      }
      $('#gb-name').value = '';
      $('#gb-github').value = '';
      $('#gb-msg').value = '';
      $('#gb-solution').value = '';
      gbFetch();
      // Cicada-style prize reveal. the link is the reward. the image is the puzzle.
      const prizeWrap = document.createElement('div');
      prizeWrap.className = 'gb-prize';
      prizeWrap.innerHTML = '<p>signed. one more thing.</p><p><a href="/prize.png" target="_blank" rel="noopener">download /prize.png</a></p><p style="opacity:0.55">save the file. open it in a text editor. somewhere in there is a message for you.</p>';
      const form = document.querySelector('.guestbook__form');
      if (form) form.replaceWith(prizeWrap);
    } catch (err) {
      alert('network error signing guestbook');
    }
  });
  // initial load + poll while visible
  gbFetch();
  const gbEl = document.querySelector('.guestbook');
  if (gbEl && 'IntersectionObserver' in window) {
    let pollTimer = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting && !pollTimer) {
          pollTimer = setInterval(gbFetch, 20000);
        } else if (!en.isIntersecting && pollTimer) {
          clearInterval(pollTimer); pollTimer = null;
        }
      });
    });
    io.observe(gbEl);
  }`);

// ──────────────────────────────────────────────────────────────────────────
// write out
// ──────────────────────────────────────────────────────────────────────────
const outPath = resolve('public/index.html');
writeFileSync(outPath, html, 'utf8');
console.log('\npatched index.html →', outPath);
console.log(report.join('\n'));
console.log('\nall 8 patches applied. start the server with: npm start');
