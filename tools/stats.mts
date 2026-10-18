// Rebuild the monoid, run the finite proof on the 2013 dictionary, and check the single-board and
// multi-board claims. Usage: node tools/stats.mts → runs/stats.json
import { writeFileSync } from 'node:fs';
import { burnsideCount } from '../src/board.ts';
import { wordName } from '../src/monoid.ts';
import {
  CLASSES, LIVE, P, Q, automorphisms, grundy, image, indistinguishable, kinds, mutations, paperPhi, proveSums,
  valueOf,
} from '../src/quotient.ts';
import {
  emptyBoards, knightStrategy, mimicry, rotationStrategy, tameGuess, winningFirstMoves, winningMoves,
} from '../src/analysis.ts';

const out: Record<string, unknown> = { node: process.version };
const time = <T,>(f: () => T): [T, number] => {
  const t = performance.now();
  const r = f();
  return [r, Math.round(performance.now() - t)];
};

out.classes = { listed: CLASSES.length, burnside: burnsideCount(), live: LIVE.length };
out.monoid = {
  elements: Q.names,
  rules: Q.rules.map((r) => `${wordName(r.lhs)} → ${wordName(r.rhs)}`),
  criticalPairs: Q.completionSteps,
  P: [...P].map((x) => Q.names[x]),
};
const phi = paperPhi();
const [proof, proofMs] = time(() => proveSums(phi));
out.proof = { ...proof, ms: proofMs };
console.log('proof', proof, proofMs, 'ms');
out.kinds = kinds(phi).map((k) => ({ value: Q.names[k.phi], options: k.opts.map((y) => Q.names[y]), classes: k.classes.length }));
out.image = image(phi).length;
out.indistinguishable = indistinguishable().length;
const [auts, autMs] = time(() => automorphisms());
out.automorphisms = auts.map((s) => ({
  map: ['a', 'b', 'c', 'd'].map((g) => `${g}→${Q.names[s[Q.of(g)]]}`).join(' '),
  changedEntries: phi.filter((v) => s[v] !== v).length,
  proofOk: proveSums(phi.map((v) => s[v])).ok,
}));
out.automorphismMs = autMs;
const [mut, mutMs] = time(() => mutations(phi));
out.mutations = { tried: mut.tried, caught: mut.caught, missed: mut.missed.length, ms: mutMs };
console.log('aut', auts.length, 'mutations', mut.tried, mut.caught);

// value counts over the 102 and the live 46
const counts: Record<string, { all: number; live: number }> = {};
CLASSES.forEach((_, i) => {
  const n = Q.names[phi[i]];
  counts[n] ??= { all: 0, live: 0 };
  counts[n].all++;
  if (LIVE.includes(i)) counts[n].live++;
});
out.valueCounts = counts;

out.oneBoard = { winningFirstMoves: winningFirstMoves(), knight: knightStrategy(), rotation: rotationStrategy() };
out.emptyBoards = [1, 2, 3, 4, 5, 6].map((n) => ({ n, ...emptyBoards(phi, n) }));
out.mimicry = mimicry(phi);
const noMimic = [0b000010101, 0b000010001];
out.noMimic = {
  value: Q.names[valueOf(phi, noMimic)],
  winning: winningMoves(phi, noMimic),
  mimicMoveValue: Q.names[valueOf(phi, [noMimic[0], noMimic[1] | 0b100])],
};
const g = grundy();
const byValue: Record<string, number[]> = {};
for (const i of LIVE) (byValue[Q.names[phi[i]]] ??= []).includes(g[i]) || byValue[Q.names[phi[i]]].push(g[i]);
out.grundyByValue = byValue;
out.grundyMax = Math.max(...LIVE.map((i) => g[i]));
const [tame, tameMs] = time(() => tameGuess(phi, 4));
out.tame = tame;
out.tameMs = tameMs;
console.log('tame', tame.map((r) => `${r.boards}:${r.wrong}/${r.sums}`).join(' '));
writeFileSync('runs/stats.json', JSON.stringify(out, null, 1) + '\n');
