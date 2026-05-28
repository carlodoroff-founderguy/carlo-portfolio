# Architecture — Signal Chain v2

This replaces the old integration guide, which spoiled the entire solution. v2
has nothing to spoil: the solution is computed per-session at runtime and never
written to any file. This doc explains the moving parts so future-you can
operate and extend it — not how to "win."

## Threat model (what v1 got wrong)

| v1 leak                                         | v2 fix                                                        |
|-------------------------------------------------|---------------------------------------------------------------|
| Answers hardcoded (`SHIP`, `CARLO`) in source   | No answers in source. Per-session, derived from `PUZZLE_SECRET`. |
| Tokens embedded in served HTML (`__LEVEL_TOKEN__`) | Tokens minted only by the server after a verified proof.   |
| `/signal.json` returned the cipher + the hint   | Decoy only. The real burst is per-session ciphertext.         |
| Levels independent — claim any/all at once      | Strict chain: stage N needs the signed proof from stage N-1.  |
| `INTEGRATION.md` documented every answer         | This file. No answers exist to document.                      |

## The chain

A stateless, signed session token carries `sid.stage.expiry.sig`, where
`sig = HMAC(PUZZLE_SECRET, sid.stage.expiry)`. `sid` is 12 random bytes minted at
`/api/chain/start`. You cannot forge a stage bump without the secret, and you
cannot pre-fetch later stages because each `/step` requires presenting the
previous stage's token.

Per-session secrets, all derived (never stored, never shipped):

```
powPrefix(sid)  = HMAC(secret, "pow|"+sid)[:16]
earnedKey(sid)  = letters(HMAC(secret, "key|"+sid), 5)     # PoW reward → Vigenère key
passphrase(sid) = letters(HMAC(secret, "pass|"+sid), 7)    # DECRYPT answer
relicCode(sid)  = letters(HMAC(secret, "relic|"+sid), 6)   # RELIC answer
cipherText(sid) = vigenere(passphrase, earnedKey)          # what DECRYPT shows
relicBlob(sid)  = base64(reverse(relicCode))               # what RELIC shows
```

Stages (`server.js` → `/api/chain/step`):

1. **MINE** — client finds `nonce` s.t. `sha256(powPrefix + ":" + nonce)` has
   `POW_BITS` leading zero bits. Server verifies, returns `earnedKey` + the
   ciphertext.
2. **DECRYPT** — client decrypts the Vigenère burst with the earned key, submits
   the plaintext; server compares to `passphrase`.
3. **GEMATRIA** — server sends a per-session rune sequence (Cicada Gematria
   Primus, single-letter runes). Client sums the runes' prime values, submits
   the integer; server compares to `gematriaSum`.
4. **PRIME** — server sends a per-session composite `n`. Client submits its
   largest prime factor; server compares to `primeAnswer`.
5. **RELIC** — client base64-decodes + reverses the blob, submits; server
   compares to `relicCode`.
6. **SOLVED** — server issues the final chain token. `POST /api/guestbook`
   accepts *only* a token at this stage.

Screens: `/gate` (cinematic descent) → `/signal` (CRT terminal that drives all
five locks) → reveal → `/map` (live star chart from `localStorage` progress).

## Client runner — `public/chain.js`

Browser IIFE exposing `window.__chain`. Contains a compact **synchronous**
SHA-256 (verified byte-for-byte against Node's `crypto` in `scripts/solve.mjs`)
for the miner, plus Vigenère decrypt and relic decode. `/signal` (the terminal)
drives it step by step; `index.html` loads it so the guestbook can read the
stored proof.

The proof lives in `localStorage` under `cd_puzzle_state_v1.proof`.

## Honeypots & shadow wall

- `POST /api/puzzle/claim` (old endpoint): returns a decoy token, logs
  `honeypot-claim`.
- `GET /api/skeleton-key` (named only in a comment): logs `tripwire`, 404s.
- `POST /api/guestbook` with a token bag / decoy instead of a real proof: logs
  `fake-proof`, 403s.
- `GET /prize.png` without a SOLVED proof: logs `prize-no-proof`, 403s.

`GET /api/guestbook` returns `shadow_count`; `index.html` renders it under the
list. The site's own `SHIP`/`CARLO` eggs no longer call the claim endpoint, so
ordinary visitors are never flagged — only deliberate use of the deprecated
surface trips a honeypot.

## index.html hooks (unchanged in spirit)

Hero aside line, console breadcrumbs, works-catalog gap, `SHIP`/`CARLO` eggs,
the filter overlay, and the guestbook are all still there. What changed:

- guestbook submit sends `proof` (from `window.__chain.proof()`), not a token bag;
- the prize link carries `?p=<proof>`;
- `SHIP`/`CARLO` `.claim()` calls removed (they were honeypot bait for innocents);
- solvers arriving from `/signal` get `body.filter-passed` so the guestbook shows.

## Tuning

- **Difficulty:** `PUZZLE_POW_BITS`. 18 ≈ a second or two in-browser; each +1
  doubles expected work. Don't exceed ~24 unless you want to punish phones.
- **Secret rotation:** change `PUZZLE_SECRET`, restart, and re-run
  `npm run embed-prize`. All in-flight sessions invalidate (by design).
- **Add a stage:** extend the `STAGE` ladder and add a branch in `/step`. Keep
  the rule: the answer is derived from `sid`+secret and verified server-side;
  the client only ever receives ciphertext or a challenge, never the answer.
