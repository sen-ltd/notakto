// The misère quotient of 3x3 X-only tic-tac-toe, and a finite proof that it decides every sum.
//
// A sum is a multiset of boards; a move puts an X on one live board; the player who kills the last
// live board loses (misère: with no live board left, the player to move has won). Plambeck and
// Whitehead (2013) give an 18-element monoid Q, a set P ⊂ Q and a value Φ(G) ∈ Q for each of the
// 102 boards up to symmetry: a sum is a second-player win iff the product of its values lies in P.

import { CELLS, canonical, classes, isDead, moves, popcount } from './board.ts';
import { Monoid, NOTAKTO_P, NOTAKTO_RELATIONS } from './monoid.ts';

/** the red labels of the 2013 figure, in its order (count of X's, then cell list) */
export const PAPER_VALUES = (
  'c 1 1 c2 ad b b b a ' +
  'a b a 1 b ab d a d ' +
  'd a ab a a 1 1 ab b ' +
  '1 1 1 1 1 a a a b ' +
  'b 1 1 b ab ab b b a ' +
  '1 b a b 1 a 1 1 1 ' +
  '1 1 1 1 1 1 1 1 b ' +
  'b a 1 1 1 1 1 a a ' +
  '1 1 1 1 1 1 1 1 1 ' +
  '1 1 1 1 1 1 a 1 1 ' +
  '1 1 1 1 1 1 1 1 1 ' +
  '1 1 1'
).split(' ');

export const Q = new Monoid(NOTAKTO_RELATIONS);
export const P = new Set(NOTAKTO_P.map((s) => Q.of(s)));
export const ONE = 0;
export const inP = (x: number) => P.has(x);

/** the 102 classes in the figure's order */
export const CLASSES = classes();
export const classIndex = new Map(CLASSES.map((m, i) => [m, i]));
export const classOf = (m: number) => classIndex.get(canonical(m))!;
/** the live classes (no line yet) */
export const LIVE = CLASSES.map((_, i) => i).filter((i) => !isDead(CLASSES[i]));

/** options of a class: the class after each move (dead boards included) */
export const OPTIONS: number[][] = CLASSES.map((m) => moves(m).map((c) => classOf(m | (1 << c))));

export const paperPhi = (): number[] => PAPER_VALUES.map((s) => Q.of(s));

// ---------------------------------------------------------------------------------------------
// The finite check. Fix Φ on every class. By induction on the number of empty cells, "a sum is P
// iff the product of its values is in P" holds for every sum iff it holds at every state below:
// a sum is P iff it has a live board and no move reaches a P sum, and a move on a board of class G
// turns the product x = Φ(G)·r into Φ(G')·r, where r is the product of the rest. So what decides
// the outcome is x and, for each kind of board present, r. A kind is (Φ(G), {Φ(G')}): boards of the
// same kind are interchangeable here. The states reachable by adding boards one at a time are
// finitely many, and checking each of them checks every sum of every size.

export interface Kind { phi: number; opts: number[]; classes: number[] }

export function kinds(phi: number[], classSet: number[] = LIVE): Kind[] {
  const byKey = new Map<string, Kind>();
  for (const g of classSet) {
    const opts = [...new Set(OPTIONS[g].map((h) => phi[h]))].sort((a, b) => a - b);
    const key = `${phi[g]}:${opts.join(',')}`;
    if (!byKey.has(key)) byKey.set(key, { phi: phi[g], opts, classes: [] });
    byKey.get(key)!.classes.push(g);
  }
  return [...byKey.values()];
}

export interface ProofResult {
  ok: boolean;
  states: number;
  kinds: number;
  /** a failing state, as the kinds present and the products */
  failure?: { kinds: number[]; x: number; ruleSaysP: boolean };
}

export function proveSums(phi: number[], classSet: number[] = LIVE): ProofResult {
  const ks = kinds(phi, classSet);
  // state: x and r[k] for each kind k (-1 = kind absent); r of a present kind is the product of the
  // sum without one board of that kind
  const start = [ONE, ...ks.map(() => -1)];
  const key = (s: number[]) => String.fromCharCode(...s.map((v) => v + 1));
  const seen = new Set<string>([key(start)]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const s = queue[q];
    const x = s[0];
    let present = false;
    let movesToP = false;
    for (let k = 0; k < ks.length; k++) {
      const r = s[k + 1];
      if (r < 0) continue;
      present = true;
      if (ks[k].opts.some((y) => inP(Q.mul[y][r]))) movesToP = true;
    }
    const outcomeP = present && !movesToP;
    if (outcomeP !== inP(x))
      return {
        ok: false, states: seen.size, kinds: ks.length,
        failure: { kinds: ks.map((_, k) => k).filter((k) => s[k + 1] >= 0), x, ruleSaysP: inP(x) },
      };
    for (let u = 0; u < ks.length; u++) {
      const t = [Q.mul[x][ks[u].phi]];
      for (let k = 0; k < ks.length; k++) {
        const r = s[k + 1];
        if (k === u) t.push(r < 0 ? x : Q.mul[r][ks[u].phi]);
        else t.push(r < 0 ? -1 : Q.mul[r][ks[u].phi]);
      }
      const kt = key(t);
      if (!seen.has(kt)) {
        seen.add(kt);
        queue.push(t);
      }
    }
  }
  return { ok: true, states: seen.size, kinds: ks.length };
}

/**
 * Automorphisms of (Q, P): permutations σ with σ(xy) = σ(x)σ(y) and σ(P) = P, found by trying every
 * image of the four generators. If Φ and Φ' both decide every sum and Q is reduced, Φ' = σ∘Φ for one
 * of these, so a trivial group means the dictionary is the only one that works.
 */
export function automorphisms(): number[][] {
  const gens = ['a', 'b', 'c', 'd'].map((g) => Q.of(g));
  const out: number[][] = [];
  const img = [0, 0, 0, 0];
  const tryAll = (i: number) => {
    if (i < gens.length) {
      for (let y = 0; y < Q.size; y++) (img[i] = y), tryAll(i + 1);
      return;
    }
    // σ of an element = product of the generator images along its exponent vector
    const sigma = Q.elements.map((w) => Q.product(w.flatMap((e, g) => Array(e).fill(img[g]))));
    if (new Set(sigma).size !== Q.size) return;
    for (let x = 0; x < Q.size; x++) {
      if (inP(x) !== inP(sigma[x])) return;
      for (let y = 0; y < Q.size; y++) if (sigma[Q.mul[x][y]] !== Q.mul[sigma[x]][sigma[y]]) return;
    }
    out.push(sigma);
  };
  tryAll(0);
  return out;
}

/** change one live entry of the dictionary to each other element and see whether the check notices */
export function mutations(phi: number[]): { tried: number; caught: number; missed: [number, number][] } {
  let tried = 0, caught = 0;
  const missed: [number, number][] = [];
  for (const g of LIVE)
    for (let q = 0; q < Q.size; q++) {
      if (q === phi[g]) continue;
      const m = phi.slice();
      m[g] = q;
      tried++;
      if (!proveSums(m).ok) caught++;
      else missed.push([g, q]);
    }
  return { tried, caught, missed };
}

/** elements reached as products of board values (Φ is onto iff this is all of Q) */
export function image(phi: number[]): number[] {
  const seen = new Set<number>([ONE]);
  const queue = [ONE];
  for (let i = 0; i < queue.length; i++)
    for (const g of LIVE) {
      const y = Q.mul[queue[i]][phi[g]];
      if (!seen.has(y)) seen.add(y), queue.push(y);
    }
  return [...seen].sort((a, b) => a - b);
}

/** pairs of elements no context tells apart (empty iff Q is reduced) */
export function indistinguishable(): [number, number][] {
  const out: [number, number][] = [];
  for (let x = 0; x < Q.size; x++)
    for (let y = 0; y < x; y++)
      if (Q.mul[x].every((_, z) => inP(Q.mul[x][z]) === inP(Q.mul[y][z]))) out.push([x, y]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Plain game search, no monoid: outcome of a multiset of live classes (sorted class indices).

export class Brute {
  memo = new Map<string, boolean>();
  /** true if the player to move wins */
  nextWins(boards: number[]): boolean {
    if (boards.length === 0) return true;
    const key = boards.join(',');
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    let win = false;
    for (let i = 0; i < boards.length && !win; i++) {
      if (i > 0 && boards[i] === boards[i - 1]) continue;
      for (const h of OPTIONS[boards[i]]) {
        const rest = boards.slice(0, i).concat(boards.slice(i + 1));
        if (!isDead(CLASSES[h])) {
          rest.push(h);
          rest.sort((a, b) => a - b);
        }
        if (!this.nextWins(rest)) {
          win = true;
          break;
        }
      }
    }
    this.memo.set(key, win);
    return win;
  }
}

/** normal-play Grundy values (last player to move wins), dead boards 0 */
export function grundy(): number[] {
  const g = CLASSES.map(() => -1);
  const order = CLASSES.map((_, i) => i).sort((x, y) => popcount(CLASSES[y]) - popcount(CLASSES[x]));
  for (const i of order) {
    if (isDead(CLASSES[i])) {
      g[i] = 0;
      continue;
    }
    const s = new Set(OPTIONS[i].map((h) => g[h]));
    let v = 0;
    while (s.has(v)) v++;
    g[i] = v;
  }
  return g;
}

/** the value of a whole position (array of masks, dead boards allowed) */
export const valueOf = (phi: number[], boards: number[]) => Q.product(boards.map((m) => phi[classOf(m)]));

export { CELLS };
