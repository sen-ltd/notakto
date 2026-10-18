// One 3x3 board of X-only tic-tac-toe. A position is a 9-bit mask of the cells holding an X,
// cells numbered row by row:
//   0 1 2
//   3 4 5
//   6 7 8
// A board with three X's in a line is dead: out of play, no moves.

export const CELLS = 9;
export const FULL = (1 << CELLS) - 1;
export const LINES = [0b000000111, 0b000111000, 0b111000000, 0b001001001, 0b010010010, 0b100100100, 0b100010001, 0b001010100];

export const popcount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

export const isDead = (m: number) => LINES.some((l) => (m & l) === l);

export const cellsOf = (m: number) => {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (m & (1 << i)) out.push(i);
  return out;
};

/** the eight symmetries of the square, as cell permutations (p[i] = image of cell i) */
export const SYMMETRIES: number[][] = (() => {
  const rot = (i: number) => (i % 3) * 3 + (2 - Math.floor(i / 3)); // (r, c) → (c, 2 - r)
  const flip = (i: number) => Math.floor(i / 3) * 3 + (2 - (i % 3)); // (r, c) → (r, 2 - c)
  const out: number[][] = [];
  for (const f of [false, true])
    for (let r = 0; r < 4; r++) {
      const p: number[] = [];
      for (let i = 0; i < CELLS; i++) {
        let j = f ? flip(i) : i;
        for (let k = 0; k < r; k++) j = rot(j);
        p.push(j);
      }
      out.push(p);
    }
  return out;
})();

export const apply = (m: number, p: number[]) => {
  let r = 0;
  for (let i = 0; i < CELLS; i++) if (m & (1 << i)) r |= 1 << p[i];
  return r;
};

/** lexicographic order on the sorted lists of occupied cells (the order of the 2013 dictionary) */
export function lexLess(x: number, y: number): boolean {
  const a = cellsOf(x), b = cellsOf(y);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
}

/** the representative of m's class: the image whose cell list is lexicographically smallest */
export function canonical(m: number): number {
  let best = m;
  for (const p of SYMMETRIES) {
    const t = apply(m, p);
    if (lexLess(t, best)) best = t;
  }
  return best;
}

/** all 2^9 masks up to symmetry, ordered by number of X's, then lexicographically by cell list */
export function classes(): number[] {
  const reps = new Set<number>();
  for (let m = 0; m <= FULL; m++) reps.add(canonical(m));
  return [...reps].sort((x, y) => popcount(x) - popcount(y) || (lexLess(x, y) ? -1 : 1));
}

/** Burnside: (1/8) Σ_g 2^(cycles of g) */
export function burnsideCount(): number {
  let s = 0;
  for (const p of SYMMETRIES) {
    const seen = new Array(CELLS).fill(false);
    let cyc = 0;
    for (let i = 0; i < CELLS; i++) {
      if (seen[i]) continue;
      cyc++;
      for (let j = i; !seen[j]; j = p[j]) seen[j] = true;
    }
    s += 2 ** cyc;
  }
  return s / SYMMETRIES.length;
}

/** the empty cells of a live board (moves, including the ones that kill it) */
export const moves = (m: number) => (isDead(m) ? [] : cellsOf(FULL & ~m));

/** a move is suicidal if it completes a line */
export const kills = (m: number, cell: number) => isDead(m | (1 << cell));
