// scripts/solve.mjs — reference solver + smoke test for the Signal Chain.
// Loads the SAME client runner the browser uses (public/chain.js) and walks the
// whole chain against a running server, then signs the guestbook with the proof.
// Also confirms the honeypot path is rejected. Usage: node scripts/solve.mjs [baseUrl]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// only accept a real http(s) URL as the base; ignore stray args (e.g. a pasted
// trailing "# comment"). defaults to localhost.
const arg = process.argv[2];
const BASE = arg && /^https?:\/\//.test(arg) ? arg.replace(/\/$/, '') : 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// load chain.js (browser IIFE) into a sandbox with fetch + localStorage shims
const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'chain.js'), 'utf8');
const store = new Map();
const ctx = {
  console, fetch, atob, URL, TextEncoder,
  localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
};
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(code.replaceAll("'/api/chain", `'${BASE}/api/chain`), ctx);
const chain = ctx.__chain;

const log = (stage, info) => {
  if (stage === 'mining') process.stdout.write(`\r  mining… ${info.hashes} hashes`);
  else console.log(`  · ${stage}` + (info && Object.keys(info).length ? '  ' + JSON.stringify(info) : ''));
};

async function main() {
  console.log(`solving ${BASE} …`);
  const t0 = Date.now();
  const proof = await chain.solve(log);
  console.log(`\nSOLVED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('proof:', proof);

  // sign the guestbook with the earned proof
  const sign = await fetch(`${BASE}/api/guestbook`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'reference-solver', message: 'the chain holds.', solution: 'mined, decrypted, summed, factored, named the relic.',
      steps_completed: ['mine', 'decrypt', 'gematria', 'prime', 'relic', 'solved'], time_to_complete: Date.now() - t0, proof,
    }),
  });
  console.log('guestbook (valid proof):', sign.status, await sign.json());

  // honeypot: old-style answer + tokens bag must be rejected AND logged
  await fetch(`${BASE}/api/puzzle/claim`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ level: 'L6_carlo', answer: 'CARLO' }),
  });
  const cheat = await fetch(`${BASE}/api/guestbook`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'i read server.js', solution: 'SHIP/CARLO', tokens: { L6_carlo: 'x' } }),
  });
  console.log('guestbook (cheat path):', cheat.status, await cheat.json());

  const gb = await (await fetch(`${BASE}/api/guestbook`)).json();
  console.log(`entries: ${gb.count}  ·  shadow flags: ${gb.shadow_count}`);
  console.log('recent shadow:', gb.shadow.map(s => s.kind));

  const okValid = sign.status === 200;
  const okCheat = cheat.status === 403;
  const okShadow = gb.shadow_count >= 2;
  console.log((okValid && okCheat && okShadow) ? '\nALL CHECKS PASSED' : '\nCHECKS FAILED');
  process.exit(okValid && okCheat && okShadow ? 0 : 1);
}
main().catch(e => { console.error('\nERROR:', e.message, e.detail || ''); process.exit(1); });
