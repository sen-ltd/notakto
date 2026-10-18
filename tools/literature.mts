// Compare the 2013 note's claims with runs/*.json and write src/results.json for the page.
// Usage: node tools/literature.mts   (after npm run stats and npm run brute)
import { readFileSync, writeFileSync } from 'node:fs';

const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const s = read('runs/stats.json');
const b = read('runs/brute.json');
const fmt = (x: number) => x.toLocaleString('en-US');
const cell = ['top-left', 'top-middle', 'top-right', 'middle-left', 'centre', 'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right'];
const bruteRows = b.rows as { boards: number; sums: number; pPositions: number; mismatches: number }[];
const bruteTotal = bruteRows.reduce((t, r) => t + r.sums, 0);
if (s.valueCounts.d.live !== 3 || s.grundyByValue.d.join() !== '4' || Object.entries(s.grundyByValue).some(([v, g]) => v !== 'd' && (g as number[]).includes(4))) throw new Error('Grundy 4 / d no longer match');
const bruteBad = bruteRows.reduce((t, r) => t + r.mismatches, 0);
const deadOnes = s.valueCounts['1'].all - s.valueCounts['1'].live;
const swaps = (s.automorphisms as { changedEntries: number }[]).filter((a) => a.changedEntries > 0);

const claims = [
  {
    claim: '102 non-isomorphic ways of arranging zero to nine X\'s',
    result: `yes: ${s.classes.listed} classes, Burnside gives ${s.classes.burnside}; ${s.classes.live} of them have no line`,
    ok: s.classes.listed === 102 && s.classes.burnside === 102,
  },
  {
    claim: 'Q = ⟨a,b,c,d | a²=1, b³=b, b²c=c, c³=ac², b²d=d, cd=ad, d²=c²⟩ has eighteen elements, the ones listed',
    result: `yes: the seven relations are already a complete rewriting system (${s.monoid.criticalPairs} critical pairs, none new); ${s.monoid.elements.length} normal forms`,
    ok: s.monoid.elements.length === 18,
  },
  {
    claim: 'multiply the dictionary values; the sum is a P-position iff the product is in P = {a, b², bc, c²}',
    result: `yes, for sums of any size: a finite check over ${fmt(s.proof.states)} states (${s.proof.kinds} kinds of board) proves it; plain search agrees on all ${fmt(bruteTotal)} sums of up to ${bruteRows.length} boards (${bruteBad} mismatches)`,
    ok: s.proof.ok && bruteBad === 0,
  },
  {
    claim: 'Q is the misère quotient',
    result: `yes: the products reach all ${s.image} elements and no two elements behave alike in every context (${s.indistinguishable} pairs)`,
    ok: s.image === 18 && s.indistinguishable === 0,
  },
  {
    claim: 'positions with too many completed rows are all assigned the identity',
    result: `yes: all ${deadOnes} dead boards are 1 (and ${s.valueCounts['1'].live} live ones too)`,
    ok: deadOnes === s.classes.listed - s.classes.live,
  },
  {
    claim: 'the dictionary (Figure 7)',
    result: `forced: each of the ${fmt(s.mutations.tried)} one-entry changes breaks the proof. (Q, P) has ${s.automorphisms.length} automorphisms; ${swaps.length} of them rename d and relabel the ${swaps[0]?.changedEntries} d/ad entries, and those dictionaries work too`,
    ok: s.mutations.caught === s.mutations.tried,
  },
  {
    claim: 'one board: the first player wins by playing in the centre',
    result: `yes; the empty board is ${s.emptyBoards[0].value}`,
    ok: s.emptyBoards[0].value === 'c' && !s.emptyBoards[0].p,
  },
  {
    claim: '…then wherever the second player plays, a knight\'s move away from that',
    result: `yes, as long as the knight's move does not complete a line (${s.oneBoard.knight.killing} times one of the two would); whenever two such moves exist (${s.oneBoard.knight.choices} times) both win`,
    ok: s.oneBoard.knight.someWins && s.oneBoard.knight.everyWins,
  },
  {
    claim: 'any move other than the centre loses: reply diametrically opposite, then rotate by 180°',
    result: `yes: centre is the only winning first move, and the rotation reply wins against all ${s.oneBoard.rotation.first} other openings and every continuation`,
    ok: s.oneBoard.winningFirstMoves.length === 1 && s.oneBoard.winningFirstMoves[0] === 4 && s.oneBoard.rotation.allWin,
  },
  {
    claim: 'two empty boards: c², a second-player win',
    result: 'yes',
    ok: s.emptyBoards[1].value === 'c²' && s.emptyBoards[1].p,
  },
  {
    claim: 'after a centre opening, copying it on the other board wins (c⁴ = c²)',
    result: `yes; after a corner or edge opening the copy loses (1·1 = 1). Of the ${s.mimicry.symmetricP + s.mimicry.symmetricN} live boards, ${s.mimicry.symmetricP} are P when doubled`,
    ok: s.mimicry.fromEmpty.find((r: { cell: number }) => r.cell === 4).copyWins,
  },
  {
    claim: 'Figure 5 is an N-position and the copy (top-right of the right board) loses',
    result: `yes: ${s.noMimic.value}, the copy makes ${s.noMimic.mimicMoveValue}. The winning replies: ${(s.noMimic.winning as [number, number][]).map(([bd, c]) => `${cell[c]} of the ${bd ? 'right' : 'left'} board`).join(', ')} (the last one completes the diagonal)`,
    ok: s.noMimic.value === 'ab' && s.noMimic.mimicMoveValue === '1',
  },
  {
    claim: 'the empty board is {2+, 0} and nim-heap 4 occurs as a single board (footnote)',
    result: `not checked (misère canonical forms are not implemented); the three boards with Grundy value 4 are exactly the ones valued d`,
    ok: null,
  },
];

const results = {
  claims,
  monoid: s.monoid,
  proof: s.proof,
  brute: bruteRows,
  emptyBoards: s.emptyBoards,
  tame: (s.tame as { boards: number; sums: number; wrong: number }[]).map(({ boards, sums, wrong }) => ({ boards, sums, wrong })),
  grundyByValue: s.grundyByValue,
};
writeFileSync('src/results.json', JSON.stringify(results, null, 1) + '\n');
for (const c of claims) console.log(c.ok === null ? '—' : c.ok ? '✓' : '✗', c.claim, '|', c.result);
