// The computer's move, and hints, on a row of boards.
import { FULL, cellsOf, isDead, kills } from './board.ts';
import { Q, classOf, inP } from './quotient.ts';

export interface Move { board: number; cell: number }
export interface Hint extends Move { value: number; wins: boolean; kills: boolean }

/** every move with the value of the position it leads to; `wins` = leads to a P-position */
export function hints(phi: number[], boards: number[]): Hint[] {
  const vals = boards.map((m) => phi[classOf(m)]);
  const out: Hint[] = [];
  boards.forEach((m, i) => {
    if (isDead(m)) return;
    const rest = Q.product(vals.filter((_, j) => j !== i));
    for (const cell of cellsOf(FULL & ~m)) {
      const value = Q.mul[rest][phi[classOf(m | (1 << cell))]];
      out.push({ board: i, cell, value, wins: inP(value), kills: kills(m, cell) });
    }
  });
  return out;
}

/**
 * A winning move if there is one. Otherwise, from a lost position, a move that does not kill a board
 * if possible (the game goes on and the opponent has to find the answer), chosen at random.
 */
export function computerMove(phi: number[], boards: number[], rnd: () => number = Math.random): Move | null {
  const hs = hints(phi, boards);
  if (!hs.length) return null;
  const win = hs.filter((h) => h.wins);
  const safe = hs.filter((h) => !h.kills);
  const pool = win.length ? win : safe.length ? safe : hs;
  const h = pool[Math.floor(rnd() * pool.length)];
  return { board: h.board, cell: h.cell };
}

export const liveCount = (boards: number[]) => boards.filter((m) => !isDead(m)).length;
