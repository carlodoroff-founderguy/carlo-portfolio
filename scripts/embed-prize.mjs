// scripts/embed-prize.mjs — (re)embed the prize payload into public/prize.png.
// Dependency-free PNG surgery: strips any existing text chunks, inserts a fresh
// ROT13 payload as a tEXt chunk AND as a post-IEND trailer (what you see when
// you open the file in a text editor). The WIN code is DERIVED from
// PUZZLE_SECRET, so the copy committed to the repo carries only a throwaway dev
// code — production embeds a different one at deploy. Reading the file in the
// repo does not reveal the real code.
//
//   PUZZLE_SECRET=… node scripts/embed-prize.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'prize.png');
const SECRET = process.env.PUZZLE_SECRET || 'dev-secret-change-me-in-production';
const EMAIL = process.env.PRIZE_EMAIL || 'carlo@joincraze.com';

const rot13 = (s) => s.replace(/[a-z]/gi, (c) => {
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
});

// derived, non-guessable win code
const n = parseInt(crypto.createHmac('sha256', SECRET).update('prize-code').digest('hex').slice(0, 6), 16) % 10000;
const WIN_CODE = 'ORION-' + String(n).padStart(4, '0');

const plain =
  `Well played.\n` +
  `Email ${EMAIL} with the subject "WIN" and this code:\n` +
  `  ${WIN_CODE}\n` +
  `Tell me what you built to get here.\n` +
  `Bring work. We'll talk.\n` +
  `  — c`;
const cipher = rot13(plain);

// ── CRC-32 (PNG) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function textChunk(keyword, text) {
  const data = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')]);
  const type = Buffer.from('tEXt', 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  return Buffer.concat([len, type, data, crc]);
}

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const raw = fs.readFileSync(OUT);
if (!raw.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');

// parse chunks, dropping any text chunks and anything after IEND
const kept = [];
let off = 8;
while (off < raw.length) {
  const len = raw.readUInt32BE(off);
  const type = raw.toString('latin1', off + 4, off + 8);
  const end = off + 12 + len;
  if (end > raw.length) break; // trailing junk after IEND — ignore
  if (!['tEXt', 'iTXt', 'zTXt'].includes(type)) kept.push(raw.subarray(off, end));
  off = end;
  if (type === 'IEND') break;
}

const iendIdx = kept.findIndex(c => c.toString('latin1', 4, 8) === 'IEND');
const iend = kept.splice(iendIdx, 1)[0];
const rebuilt = Buffer.concat([
  SIG, ...kept,
  textChunk('cicada', cipher),
  textChunk('hint', 'rot13. caesar cipher. same as 3301.'),
  iend,
]);

const trailer =
  '\n\n' +
  '================================================================\n' +
  '  you are reading the file in a text editor. good.\n' +
  '  the payload below is a caesar cipher (rot13).\n' +
  '  it is also embedded as PNG metadata above.\n' +
  '================================================================\n' +
  cipher + '\n' +
  '================================================================\n';

fs.writeFileSync(OUT, Buffer.concat([rebuilt, Buffer.from(trailer, 'utf8')]));
console.log(`wrote ${OUT}  (${fs.statSync(OUT).size} bytes)`);
console.log(`win code: ${WIN_CODE}  ·  rot13 in file: ${rot13(WIN_CODE)}`);
if (SECRET.startsWith('dev-secret')) console.warn('WARNING: dev secret — this is a throwaway code. set PUZZLE_SECRET for production.');
