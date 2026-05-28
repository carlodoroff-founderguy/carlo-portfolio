// ══════════════════════════════════════════════════════════════════════════
// chain.js — client runner for SIGNAL CHAIN v2
// Drives the server-authoritative puzzle: start → mine → decrypt → relic.
// Nothing here is a secret. The miner just burns CPU; the math is the lock.
// Exposes window.__chain. Works in the browser and under Node (for testing).
// ══════════════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // ── compact synchronous SHA-256 (bytes in → 32 bytes out) ──
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(bytes) {
    const l = bytes.length;
    const bitLen = l * 8;
    const withOne = l + 1;
    const k = (56 - (withOne % 64) + 64) % 64;
    const total = withOne + k + 8;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[l] = 0x80;
    // 64-bit big-endian length (we only support < 2^32 bits, plenty here)
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);

    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
        h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w = new Uint32Array(64);

    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
        const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h=g; g=f; f=e; e=(d + t1)|0; d=c; c=b; b=a; a=(t1 + t2)|0;
      }
      h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
      h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
    }
    const out = new Uint8Array(32);
    const od = new DataView(out.buffer);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach((hv, i) => od.setUint32(i * 4, hv >>> 0, false));
    return out;
  }

  function asciiBytes(str) {
    const b = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 0xff;
    return b;
  }
  function leadingZeroBits(buf) {
    let n = 0;
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (b === 0) { n += 8; continue; }
      let v = b;
      while ((v & 0x80) === 0) { n++; v <<= 1; }
      break;
    }
    return n;
  }

  // grind a PoW nonce. async + yields so the page stays alive. onProgress(hashes).
  async function mine(prefix, bits, onProgress) {
    let nonce = 0;
    const yieldEvery = 20000;
    for (;;) {
      const d = sha256(asciiBytes(prefix + ':' + nonce));
      if (leadingZeroBits(d) >= bits) return String(nonce);
      nonce++;
      if (onProgress && nonce % yieldEvery === 0) {
        onProgress(nonce);
        if (typeof requestAnimationFrame === 'function') {
          await new Promise(r => requestAnimationFrame(r));
        }
      }
    }
  }

  // ── Vigenère decrypt over A–Z ──
  function vigenereDecrypt(ct, key) {
    let out = '';
    for (let i = 0; i < ct.length; i++) {
      const t = ct.charCodeAt(i) - 65;
      const k = key.charCodeAt(i % key.length) - 65;
      out += String.fromCharCode(65 + (((t - k) % 26) + 26) % 26);
    }
    return out;
  }
  // ── relic: base64(reverse(code)) → code ──
  function relicDecode(blob) {
    const dec = (typeof atob === 'function')
      ? atob(blob)
      : Buffer.from(blob, 'base64').toString('binary');
    return dec.split('').reverse().join('');
  }
  // ── gematria: sum of rune prime-values via the supplied table ──
  function gematriaSum(runes, table) {
    const map = new Map(table);
    let sum = 0;
    for (const g of Array.from(runes)) sum += (map.get(g) || 0);
    return sum;
  }
  // ── largest prime factor (trial division) ──
  function largestPrimeFactor(n) {
    let v = n, lpf = 1;
    for (let f = 2; f * f <= v; f++) { while (v % f === 0) { lpf = f; v /= f; } }
    if (v > 1) lpf = v;
    return lpf;
  }

  // ── HTTP helpers ──
  const _fetch = root.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  async function post(url, body) {
    const r = await _fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  const KEY = 'cd_puzzle_state_v1';
  const readState = () => {
    try { return JSON.parse(root.localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  };
  const writeState = (s) => { try { root.localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const hasLS = () => { try { return !!root.localStorage; } catch { return false; } };

  async function start() {
    const { ok, data } = await post('/api/chain/start', {});
    if (!ok || !data.ok) throw new Error('could not start chain');
    return data; // { chain, pow:{prefix,bits}, manifesto }
  }
  async function step(chain, answer) {
    const { ok, data, status } = await post('/api/chain/step', { chain, answer });
    if (!ok || !data.ok) {
      const e = new Error(data.error || ('step failed (' + status + ')'));
      e.detail = data; throw e;
    }
    return data;
  }

  // one-shot autosolver — runs the whole chain. used by the terminal "auto"
  // path and by the test harness. onLog(stageName, info).
  async function solve(onLog) {
    const log = onLog || (() => {});
    const s0 = await start();           log('start', s0);
    const nonce = await mine(s0.pow.prefix, s0.pow.bits, (h) => log('mining', { hashes: h }));
    log('mined', { nonce });
    const s1 = await step(s0.chain, nonce);                 log('decrypt', s1);
    const plain = vigenereDecrypt(s1.cipher.ciphertext, s1.reward.key);
    log('decrypted', { plaintext: plain });
    const s2 = await step(s1.chain, plain);                 log('gematria', s2);
    const sum = gematriaSum(s2.gematria.runes, s2.gematria.table);
    log('gematria-sum', { runes: s2.gematria.runes, sum });
    const s3 = await step(s2.chain, String(sum));           log('prime', s3);
    const lpf = largestPrimeFactor(s3.prime.n);
    log('prime-factored', { n: s3.prime.n, lpf });
    const s4 = await step(s3.chain, String(lpf));           log('relic', s4);
    const code = relicDecode(s4.relic.blob);
    log('relic-decoded', { code });
    const s5 = await step(s4.chain, code);                  log('solved', s5);
    if (hasLS()) {
      const st = readState();
      st.started_at = st.started_at || Date.now();
      st.proof = s5.chain;
      st.completed_at = Date.now();
      st.steps_completed = ['mine', 'decrypt', 'gematria', 'prime', 'relic', 'solved'];
      writeState(st);
    }
    return s5.chain; // SOLVED proof
  }

  root.__chain = {
    sha256, asciiBytes, leadingZeroBits, mine,
    vigenereDecrypt, relicDecode, gematriaSum, largestPrimeFactor,
    start, step, solve,
    proof: () => (hasLS() ? readState().proof : null) || null,
    state: readState,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.__chain;
})(typeof window !== 'undefined' ? window : globalThis);
