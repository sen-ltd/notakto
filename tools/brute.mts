// Independent check without the monoid: plain game search on every sum of up to K live boards
// (classes up to symmetry, repeats allowed), compared with the product rule. The memo is one byte
// per multiset, indexed by its rank in the combinatorial number system (a Map stops at ~16.7M keys).
// Usage: node tools/brute.mts [K=6] → runs/brute.json
import { writeFileSync } from 'node:fs';
import { isDead } from '../src/board.ts';
import { CLASSES, LIVE, OPTIONS, Q, inP, paperPhi } from '../src/quotient.ts';

const K = Number(process.argv[2] ?? 6);
const phi = paperPhi();
const L = LIVE.length;
const liveIdx = new Map(LIVE.map((g, i) => [g, i]));
// options of each live board, as live indices (-1 = the move kills it)
const OPT = LIVE.map((g) => OPTIONS[g].map((h) => (isDead(CLASSES[h]) ? -1 : liveIdx.get(h)!)));
const PHI = LIVE.map((g) => phi[g]);

const binom: number[][] = [];
for (let n = 0; n <= L + K; n++) {
  binom.push([]);
  for (let k = 0; k <= K; k++) binom[n].push(k === 0 ? 1 : n === 0 ? 0 : binom[n - 1][k - 1] + binom[n - 1][k]);
}
// sorted a_0 ≤ … ≤ a_{k-1}  →  b_i = a_i + i strictly increasing  →  rank = Σ C(b_i, i+1)
const rank = (a: number[]) => a.reduce((s, x, i) => s + binom[x + i][i + 1], 0);
const memo = Array.from({ length: K + 1 }, (_, k) => new Int8Array(binom[L + k - 1 < 0 ? 0 : L + k - 1][k]));
let solved = 0;

/** 1 if the player to move wins, -1 if not */
function nextWins(a: number[]): number {
  const k = a.length;
  if (k === 0) return 1;
  const r = rank(a);
  const hit = memo[k][r];
  if (hit) return hit;
  let res = -1;
  outer: for (let i = 0; i < k; i++) {
    if (i > 0 && a[i] === a[i - 1]) continue;
    for (const h of OPT[a[i]]) {
      const rest = a.slice(0, i).concat(a.slice(i + 1));
      if (h >= 0) {
        let j = rest.length;
        rest.push(h);
        while (j > 0 && rest[j - 1] > h) (rest[j] = rest[j - 1]), j--;
        rest[j] = h;
      }
      if (nextWins(rest) < 0) {
        res = 1;
        break outer;
      }
    }
  }
  memo[k][r] = res;
  solved++;
  return res;
}

const t0 = performance.now();
const rows: { boards: number; sums: number; pPositions: number; mismatches: number; ms: number }[] = [];
for (let k = 1; k <= K; k++) {
  const t = performance.now();
  let sums = 0, pPos = 0, bad = 0;
  const pick: number[] = [];
  const go = (from: number) => {
    if (pick.length === k) {
      sums++;
      const p = nextWins(pick) < 0;
      if (p) pPos++;
      if (p !== inP(Q.product(pick.map((g) => PHI[g])))) bad++;
      return;
    }
    for (let i = from; i < L; i++) pick.push(i), go(i), pick.pop();
  };
  go(0);
  const ms = Math.round(performance.now() - t);
  rows.push({ boards: k, sums, pPositions: pPos, mismatches: bad, ms });
  console.log(`${k} boards: ${sums} sums, ${pPos} P, ${bad} mismatches, ${ms} ms, solved ${solved}`);
  writeFileSync('runs/brute.json', JSON.stringify({ node: process.version, liveClasses: L, rows, ms: Math.round(performance.now() - t0) }, null, 1) + '\n');
}
