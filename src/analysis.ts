// The single-board claims from the MathOverflow thread, mimicry on two boards, and the comparison
// with normal play: everything the 2013 note says in words, checked by search.

import { CELLS, FULL, cellsOf, isDead, kills } from './board.ts';
import { Brute, CLASSES, LIVE, Q, classOf, grundy, inP } from './quotient.ts';

const brute = new Brute();
/** true if the player to move wins the sum of these boards (masks; dead boards ignored) */
export function nextWins(boards: number[]): boolean {
  const live = boards.filter((m) => !isDead(m)).map(classOf).sort((a, b) => a - b);
  return brute.nextWins(live);
}

const empties = (m: number) => cellsOf(FULL & ~m);
export const KNIGHT: number[][] = Array.from({ length: CELLS }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  const out: number[] = [];
  for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) out.push(rr * 3 + cc);
  }
  return out;
});

/** one board: the first moves that win */
export const winningFirstMoves = () => empties(0).filter((c) => !nextWins([1 << c]));

/**
 * Chow: "the first player wins by playing in the center, and then wherever the second player plays,
 * the first player plays a knight's move away from that". Walk every second-player line. At each
 * reply, `some` asks for one knight's move that keeps winning, `every` for all knight's moves that
 * do not complete a line (`choices` counts the replies that leave two of them, `killing` the replies
 * where one of the knight's moves would complete a line).
 */
export function knightStrategy(): { someWins: boolean; everyWins: boolean; positions: number; choices: number; killing: number } {
  let positions = 0, choices = 0, killing = 0;
  const walk = (m: number, mode: 'some' | 'every'): boolean => {
    // second player to move on m (first player just moved, board alive)
    for (const x of empties(m)) {
      if (kills(m, x)) continue; // the second player loses on the spot
      const after = m | (1 << x);
      const ks = KNIGHT[x].filter((k) => !(after & (1 << k)) && !kills(after, k));
      if (mode === 'every' && ks.length > 1) choices++;
      if (mode === 'every' && KNIGHT[x].some((k) => !(after & (1 << k)) && kills(after, k))) killing++;
      const ok = (k: number) => walk(after | (1 << k), mode);
      if (!ks.length) return false;
      if (mode === 'some' ? !ks.some(ok) : !ks.every(ok)) return false;
    }
    if (mode === 'every') positions++;
    return true;
  };
  const someWins = walk(1 << 4, 'some');
  const everyWins = walk(1 << 4, 'every');
  return { someWins, everyWins, positions, choices, killing };
}

/**
 * Buzzard: after any first move other than the centre, the second player answers diametrically
 * opposite (the centre is now unplayable) and then always plays the 180° rotation of the first
 * player's move. Returns the number of first-player lines walked, and whether all were won.
 */
export function rotationStrategy(): { first: number; allWin: boolean; lines: number } {
  let lines = 0;
  const walk = (m: number): boolean => {
    // first player to move
    for (const x of empties(m)) {
      if (kills(m, x)) {
        lines++;
        continue;
      }
      const after = m | (1 << x);
      const y = 8 - x;
      if (after & (1 << y) || kills(after, y)) return false;
      if (!walk(after | (1 << y))) return false;
    }
    return true;
  };
  let allWin = true;
  let first = 0;
  for (const f of empties(0)) {
    if (f === 4) continue;
    first++;
    const m = (1 << f) | (1 << (8 - f));
    if (!walk(m)) allWin = false;
  }
  return { first, allWin, lines };
}

/** winning moves from a position, as [board, cell] */
export function winningMoves(phi: number[], boards: number[]): [number, number][] {
  const out: [number, number][] = [];
  boards.forEach((m, i) => {
    if (isDead(m)) return;
    for (const c of empties(m)) {
      const next = boards.slice();
      next[i] = m | (1 << c);
      if (inP(Q.product(next.map((b) => phi[classOf(b)])))) out.push([i, c]);
    }
  });
  return out;
}

/**
 * Mimicry from two equal boards: the first player moves on one, the second copies it on the other.
 * For every live class G (the two boards both G), list the first player's moves after which the copy
 * is a winning reply, i.e. Φ(G')² ∈ P (a copy that kills both boards ends the game and loses).
 */
export function mimicry(phi: number[]): { symmetricP: number; symmetricN: number; fromEmpty: { cell: number; copyWins: boolean }[] } {
  let symmetricP = 0, symmetricN = 0;
  for (const g of LIVE) (inP(Q.mul[phi[g]][phi[g]]) ? symmetricP++ : symmetricN++);
  const fromEmpty = [0, 1, 4].map((cell) => {
    const g = classOf(1 << cell);
    return { cell, copyWins: inP(Q.mul[phi[g]][phi[g]]) };
  });
  return { symmetricP, symmetricN, fromEmpty };
}

/**
 * Normal play would be Sprague–Grundy; misère nim's rule (Bouton) applied to Grundy values is the
 * natural guess for misère: P iff (xor = 0 and some value ≥ 2) or (xor = 1 and all values ≤ 1).
 * Count the sums of k live boards where that guess disagrees with the truth.
 */
export function tameGuess(phi: number[], maxBoards: number): { boards: number; sums: number; wrong: number; example: number[] | null }[] {
  const g = grundy();
  const rows: { boards: number; sums: number; wrong: number; example: number[] | null }[] = [];
  for (let k = 1; k <= maxBoards; k++) {
    let sums = 0, wrong = 0;
    let example: number[] | null = null;
    const pick: number[] = [];
    const go = (from: number) => {
      if (pick.length === k) {
        sums++;
        const vals = pick.map((c) => g[c]);
        const x = vals.reduce((s, v) => s ^ v, 0);
        const big = vals.some((v) => v >= 2);
        const guessP = big ? x === 0 : x === 1;
        if (guessP !== inP(Q.product(pick.map((c) => phi[c])))) {
          wrong++;
          if (!example) example = pick.map((c) => CLASSES[c]);
        }
        return;
      }
      for (let i = from; i < LIVE.length; i++) pick.push(LIVE[i]), go(i), pick.pop();
    };
    go(0);
    rows.push({ boards: k, sums, wrong, example });
  }
  return rows;
}

/** the first player's winning first moves on n empty boards (by symmetry: corner, edge, centre) */
export function emptyBoards(phi: number[], n: number): { value: string; p: boolean; winningFirst: string[] } {
  const value = Q.power(phi[classOf(0)], n);
  const after = (cell: number) => Q.mul[Q.power(phi[classOf(0)], n - 1)][phi[classOf(1 << cell)]];
  const winningFirst = [[0, 'corner'], [1, 'edge'], [4, 'centre']]
    .filter(([c]) => inP(after(c as number)))
    .map(([, name]) => name as string);
  return { value: Q.names[value], p: inP(value), winningFirst };
}
