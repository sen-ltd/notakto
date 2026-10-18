import { describe, expect, it } from 'vitest';
import { burnsideCount, canonical, classes, isDead, SYMMETRIES, apply } from './board.ts';
import { Monoid, NOTAKTO_RELATIONS, parseWord } from './monoid.ts';
import {
  Brute, CLASSES, LIVE, P, PAPER_VALUES, Q, automorphisms, classOf, grundy, image, indistinguishable, inP,
  mutations, paperPhi, proveSums, valueOf,
} from './quotient.ts';
import { emptyBoards, knightStrategy, mimicry, rotationStrategy, tameGuess, winningFirstMoves, winningMoves } from './analysis.ts';
import { computerMove, hints } from './game.ts';

const phi = paperPhi();

describe('boards', () => {
  it('has 102 classes under the 8 symmetries, 46 without a line', () => {
    expect(new Set(SYMMETRIES.map((p) => p.join())).size).toBe(8);
    expect(classes().length).toBe(102);
    expect(burnsideCount()).toBe(102);
    expect(LIVE.length).toBe(46);
  });
  it('canonical form is constant on orbits', () => {
    for (let m = 0; m < 512; m++) for (const p of SYMMETRIES) expect(canonical(apply(m, p))).toBe(canonical(m));
  });
  it('lists the classes in the order of the 2013 figure', () => {
    expect(CLASSES.slice(0, 12)).toEqual([0, 1, 2, 16, 3, 5, 17, 33, 257, 10, 18, 130]);
    expect(PAPER_VALUES.length).toBe(102);
  });
});

describe('the monoid', () => {
  it('has the eighteen elements of the note', () => {
    const listed = '1 a b ab b2 ab2 c ac bc abc c2 ac2 bc2 abc2 d ad bd abd'.split(' ');
    expect(Q.size).toBe(18);
    expect(new Set(listed.map((w) => Q.of(w))).size).toBe(18);
    for (const w of listed) expect(Q.reduce(parseWord(w))).toEqual(parseWord(w));
  });
  it('satisfies its relations and is commutative', () => {
    for (const [l, r] of NOTAKTO_RELATIONS) expect(Q.of(l)).toBe(Q.of(r));
    for (let x = 0; x < 18; x++) for (let y = 0; y < 18; y++) expect(Q.mul[x][y]).toBe(Q.mul[y][x]);
  });
  it('rejects an infinite presentation', () => {
    expect(new Monoid([['a2', 'a'], ['b2', 'b'], ['c2', 'c'], ['d2', 'd']]).size).toBe(16);
    expect(() => new Monoid([['a2', 'a']])).toThrow(/infinite/);
  });
  it('is reduced and the dictionary reaches all of it', () => {
    expect(indistinguishable()).toEqual([]);
    expect(image(phi).length).toBe(18);
    expect([...P].map((x) => Q.names[x]).sort()).toEqual(['a', 'bc', 'b²', 'c²']);
  });
});

describe('the dictionary decides every sum', () => {
  it('passes the finite check', () => {
    const r = proveSums(phi);
    expect(r.ok).toBe(true);
    expect(r.kinds).toBe(15);
    expect(r.states).toBe(285480);
  });
  it('agrees with plain search on every sum of up to three boards', () => {
    const brute = new Brute();
    let n = 0;
    for (let i = 0; i < LIVE.length; i++)
      for (let j = i; j < LIVE.length; j++)
        for (let k = j; k < LIVE.length; k++) {
          const s = [LIVE[i], LIVE[j], LIVE[k]];
          expect(!brute.nextWins(s)).toBe(inP(Q.product(s.map((g) => phi[g]))));
          n++;
        }
    expect(n).toBe(17296);
  });
  it('breaks if any one entry is changed', () => {
    const m = mutations(phi);
    expect(m.tried).toBe(46 * 17);
    expect(m.missed).toEqual([]);
  });
  it('is unique up to the four automorphisms, which only rename d', () => {
    const auts = automorphisms();
    expect(auts.length).toBe(4);
    for (const s of auts) {
      expect(s[Q.of('a')]).toBe(Q.of('a'));
      expect(s[Q.of('c')]).toBe(Q.of('c'));
      expect(proveSums(phi.map((v) => s[v])).ok).toBe(true);
    }
  });
  it('gives every dead board the identity', () => {
    for (let i = 0; i < 102; i++) if (isDead(CLASSES[i])) expect(phi[i]).toBe(0);
  });
  it('a broken dictionary is caught (ablation: swap c and c²)', () => {
    const bad = phi.slice();
    bad[0] = Q.of('c2');
    bad[classOf(16)] = Q.of('c');
    expect(proveSums(bad).ok).toBe(false);
  });
});

describe('the claims', () => {
  it('one board: only the centre wins, then knight moves; else rotate', () => {
    expect(winningFirstMoves()).toEqual([4]);
    const k = knightStrategy();
    expect(k.someWins && k.everyWins).toBe(true);
    const r = rotationStrategy();
    expect(r.first).toBe(8);
    expect(r.allWin).toBe(true);
  });
  it('n empty boards: c, c², ac², c², …', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => emptyBoards(phi, n).value)).toEqual(['c', 'c²', 'ac²', 'c²', 'ac²', 'c²']);
    const brute = new Brute();
    for (let n = 1; n <= 4; n++) expect(brute.nextWins(Array(n).fill(0))).toBe(n % 2 === 1);
  });
  it('mimicry: copying wins only after a centre opening', () => {
    const m = mimicry(phi);
    expect(m.fromEmpty.map((r) => r.copyWins)).toEqual([false, false, true]);
    expect(m.symmetricP).toBe(26);
  });
  it('Figure 5: the copy loses, four replies win', () => {
    const pos = [0b000010101, 0b000010001];
    expect(Q.names[valueOf(phi, pos)]).toBe('ab');
    expect(winningMoves(phi, pos)).toEqual([[0, 3], [0, 5], [0, 7], [1, 8]]);
  });
  it('the misère-nim guess on Grundy values fails already on one empty board', () => {
    expect(grundy()[0]).toBe(1);
    const t = tameGuess(phi, 2);
    expect(t[0].wrong).toBe(2);
    expect(t[1].wrong).toBe(41);
  });
});

describe('the computer', () => {
  it('always moves to a P-position from an N-position', () => {
    const boards = [0, 0, 0];
    let rng = 1;
    const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
    for (let turn = 0; turn < 30; turn++) {
      const before = valueOf(phi, boards);
      const mv = computerMove(phi, boards, rnd);
      if (!mv) break;
      boards[mv.board] |= 1 << mv.cell;
      if (!inP(before)) expect(inP(valueOf(phi, boards))).toBe(true);
    }
    expect(boards.every(isDead)).toBe(true);
    expect(hints(phi, boards)).toEqual([]);
  });
});
