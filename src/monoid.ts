// A finite commutative monoid from a presentation ⟨a, b, c, d | relations⟩.
// Words are exponent vectors [a, b, c, d]; relations become rewrite rules oriented by degree, then
// d > c > b > a; Knuth–Bendix completion (for commutative words, critical pairs sit at the lcm of two
// left-hand sides) makes the system confluent, and the irreducible words are the elements.

export type Word = number[];
export const GEN = ['a', 'b', 'c', 'd'];

const deg = (w: Word) => w.reduce((s, x) => s + x, 0);
/** true if x is bigger than y in the term order */
function bigger(x: Word, y: Word): boolean {
  if (deg(x) !== deg(y)) return deg(x) > deg(y);
  for (let i = GEN.length - 1; i >= 0; i--) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
const same = (x: Word, y: Word) => x.every((v, i) => v === y[i]);
const divides = (l: Word, w: Word) => l.every((v, i) => v <= w[i]);

export function parseWord(s: string): Word {
  const w = [0, 0, 0, 0];
  if (s === '1') return w;
  const re = /([abcd])(\d*)/g;
  let m: RegExpExecArray | null;
  let used = 0;
  while ((m = re.exec(s))) {
    w[GEN.indexOf(m[1])] += m[2] ? Number(m[2]) : 1;
    used += m[0].length;
  }
  if (used !== s.length) throw new Error(`bad word ${s}`);
  return w;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function wordName(w: Word, plain = false): string {
  let s = '';
  for (let i = 0; i < GEN.length; i++)
    if (w[i]) s += GEN[i] + (w[i] > 1 ? (plain ? String(w[i]) : [...String(w[i])].map((d) => SUP[+d]).join('')) : '');
  return s || '1';
}

export interface Rule { lhs: Word; rhs: Word }

export class Monoid {
  rules: Rule[] = [];
  /** elements as irreducible words, in the order they were found (breadth-first from 1) */
  elements: Word[] = [];
  names: string[] = [];
  index = new Map<string, number>();
  /** mul[x][y] = index of x·y */
  mul: number[][] = [];
  completionSteps = 0;

  constructor(relations: [string, string][]) {
    for (const [l, r] of relations) this.addRule(parseWord(l), parseWord(r));
    this.complete();
    this.enumerate();
  }

  private addRule(x: Word, y: Word): boolean {
    if (same(x, y)) return false;
    this.rules.push(bigger(x, y) ? { lhs: x, rhs: y } : { lhs: y, rhs: x });
    return true;
  }

  reduce(w: Word): Word {
    let v = w.slice();
    for (let changed = true; changed; ) {
      changed = false;
      for (const r of this.rules)
        if (divides(r.lhs, v)) {
          v = v.map((x, i) => x - r.lhs[i] + r.rhs[i]);
          changed = true;
        }
    }
    return v;
  }

  /** add the resolvent of every non-joinable critical pair until all pairs join */
  private complete() {
    for (let again = true; again; ) {
      again = false;
      outer: for (let i = 0; i < this.rules.length; i++)
        for (let j = 0; j < i; j++) {
          const p = this.rules[i], q = this.rules[j];
          const lcm = p.lhs.map((x, k) => Math.max(x, q.lhs[k]));
          const u = this.reduce(lcm.map((x, k) => x - p.lhs[k] + p.rhs[k]));
          const v = this.reduce(lcm.map((x, k) => x - q.lhs[k] + q.rhs[k]));
          this.completionSteps++;
          if (this.addRule(u, v)) {
            again = true;
            break outer;
          }
        }
    }
  }

  private enumerate() {
    const key = (w: Word) => w.join(',');
    const one = [0, 0, 0, 0];
    const queue = [one];
    this.index.set(key(one), 0);
    this.elements.push(one);
    for (let q = 0; q < queue.length; q++)
      for (let g = 0; g < GEN.length; g++) {
        const w = this.reduce(queue[q].map((x, k) => x + (k === g ? 1 : 0)));
        if (this.index.has(key(w))) continue;
        if (this.elements.length > 10000) throw new Error('monoid looks infinite');
        this.index.set(key(w), this.elements.length);
        this.elements.push(w);
        queue.push(w);
      }
    this.names = this.elements.map((w) => wordName(w));
    this.mul = this.elements.map((x) =>
      this.elements.map((y) => this.index.get(key(this.reduce(x.map((v, k) => v + y[k]))))!),
    );
  }

  get size() {
    return this.elements.length;
  }

  of(s: string): number {
    const i = this.index.get(this.reduce(parseWord(s)).join(','));
    if (i === undefined) throw new Error(`no element ${s}`);
    return i;
  }

  product(xs: Iterable<number>): number {
    let r = 0;
    for (const x of xs) r = this.mul[r][x];
    return r;
  }

  power(x: number, n: number): number {
    let r = 0;
    for (let i = 0; i < n; i++) r = this.mul[r][x];
    return r;
  }
}

/** the 2013 presentation and P-set */
export const NOTAKTO_RELATIONS: [string, string][] = [
  ['a2', '1'], ['b3', 'b'], ['b2c', 'c'], ['c3', 'ac2'], ['b2d', 'd'], ['cd', 'ad'], ['d2', 'c2'],
];
export const NOTAKTO_P = ['a', 'b2', 'bc', 'c2'];
