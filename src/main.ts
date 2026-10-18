import './style.css';
import { CELLS, LINES, isDead } from './board.ts';
import { CLASSES, LIVE, P, Q, classOf, inP, paperPhi, valueOf } from './quotient.ts';
import { computerMove, hints, type Hint } from './game.ts';
import results from './results.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nSel = $<HTMLSelectElement>('nSel');
const youSel = $<HTMLSelectElement>('youSel');
const hintsBox = $<HTMLInputElement>('hints');
const boardsEl = $('boards');
const productEl = $('product');
const statusEl = $('status');
const phi = paperPhi();
const fmt = (x: number) => x.toLocaleString('en-US');

interface Mark { board: number; cell: number }
let boards: number[] = [];
let history: Mark[] = [];
let youFirst = true;
let thinking = 0;

const humanToMove = () => (history.length % 2 === 0) === youFirst;
const over = () => boards.every(isDead);

function newGame() {
  window.clearTimeout(thinking);
  boards = Array(Number(nSel.value)).fill(0);
  history = [];
  youFirst = youSel.value === 'first';
  render();
  maybeComputer();
}

function play(m: Mark) {
  boards[m.board] |= 1 << m.cell;
  history.push(m);
  render();
  maybeComputer();
}

function maybeComputer() {
  if (over() || humanToMove()) return;
  thinking = window.setTimeout(() => {
    const mv = computerMove(phi, boards);
    if (mv) play(mv);
  }, 450);
}

function undo() {
  window.clearTimeout(thinking);
  // take back the computer's reply (if any) and your last move
  while (history.length) {
    const m = history.pop()!;
    boards[m.board] &= ~(1 << m.cell);
    if (humanToMove()) break; // the move just taken back was yours
  }
  render();
  maybeComputer();
}

function lineCells(m: number): number {
  let r = 0;
  for (const l of LINES) if ((m & l) === l) r |= l;
  return r;
}

function render() {
  const hs: Hint[] = hintsBox.checked && humanToMove() && !over() ? hints(phi, boards) : [];
  const last = history[history.length - 1];
  boardsEl.innerHTML = '';
  boards.forEach((m, i) => {
    const dead = isDead(m);
    const card = document.createElement('div');
    card.className = 'bd' + (dead ? ' dead' : '');
    const grid = document.createElement('div');
    grid.className = 'grid';
    const lc = lineCells(m);
    for (let c = 0; c < CELLS; c++) {
      const b = document.createElement('button');
      b.className = 'c';
      b.setAttribute('aria-label', `board ${i + 1} cell ${c + 1}`);
      if (m & (1 << c)) {
        b.textContent = '×';
        b.classList.add('x');
        if (lc & (1 << c)) b.classList.add('line');
        if (last && last.board === i && last.cell === c) b.classList.add('last');
        b.disabled = true;
      } else if (dead || over() || !humanToMove()) {
        b.disabled = true;
      } else {
        const h = hs.find((x) => x.board === i && x.cell === c);
        if (h) {
          b.classList.add(h.wins ? 'win' : 'loss');
          const t = document.createElement('span');
          t.className = 'tag';
          t.textContent = h.wins ? 'W' : 'L';
          b.appendChild(t);
          b.title = `leads to ${Q.names[h.value]}${h.kills ? ' (kills this board)' : ''}`;
        }
        b.addEventListener('click', () => play({ board: i, cell: c }));
      }
      grid.appendChild(b);
    }
    const val = document.createElement('div');
    val.className = 'val';
    val.textContent = dead ? 'dead · 1' : Q.names[phi[classOf(m)]];
    card.append(grid, val);
    boardsEl.appendChild(card);
  });

  const x = valueOf(phi, boards);
  const live = boards.filter((m) => !isDead(m)).map((m) => Q.names[phi[classOf(m)]]);
  productEl.innerHTML = over()
    ? ''
    : `${live.join(' · ')} = <strong>${Q.names[x]}</strong> — ` +
      (inP(x)
        ? '<span class="p">P-position</span>: the player to move loses with perfect play'
        : '<span class="n">N-position</span>: the player to move can win');

  statusEl.className = '';
  if (over()) {
    // the player who made the last move killed the last board and lost
    const youLost = !humanToMove();
    statusEl.textContent = youLost
      ? 'You killed the last board — you lose.'
      : 'The computer killed the last board — you win!';
    statusEl.className = youLost ? 'bad' : 'good';
  } else if (humanToMove()) {
    statusEl.textContent = inP(x)
      ? 'Your move. This position is lost against perfect play — make the computer find the answer.'
      : 'Your move. There is a winning move.';
  } else statusEl.textContent = 'Computer is thinking…';
  renderMonoid(x);
  renderDict();
}

function renderMonoid(x: number) {
  const el = $('monoid');
  const rel = '⟨a, b, c, d | a² = 1, b³ = b, b²c = c, c³ = ac², b²d = d, cd = ad, d² = c²⟩';
  el.innerHTML =
    `<p class="fine" style="margin:0">${rel}</p><div class="qgrid">` +
    Q.names.map((n, i) => `<span class="${P.has(i) ? 'inp' : ''} ${i === x && !over() ? 'cur' : ''}">${n}</span>`).join('') +
    `</div><p class="fine" style="margin:0">Green: P. Orange: the current product.</p>`;
}

function renderDict() {
  const inPlay = new Set(boards.filter((m) => !isDead(m)).map(classOf));
  const el = $('dict');
  el.innerHTML = LIVE.map((g) => {
    const m = CLASSES[g];
    const cells = Array.from({ length: CELLS }, (_, c) => `<i>${m & (1 << c) ? '×' : ''}</i>`).join('');
    return `<div class="mini ${inPlay.has(g) ? 'on' : ''}"><div class="g">${cells}</div><b>${Q.names[phi[g]]}</b></div>`;
  }).join('');
}

function renderStatic() {
  const r = results as unknown as {
    claims: { claim: string; result: string; ok: boolean | null }[];
    proof: { states: number; kinds: number };
    brute: { boards: number; sums: number; pPositions: number; mismatches: number }[];
    emptyBoards: { n: number; value: string; p: boolean }[];
  };
  $('checked').innerHTML =
    `<p class="fine" style="margin-top:0">Finite proof: ${fmt(r.proof.states)} states, ${r.proof.kinds} kinds of board. Plain search:</p>` +
    '<table class="t"><tr><th>boards</th><th>sums</th><th>P</th><th>mismatches</th></tr>' +
    r.brute.map((b) => `<tr><td>${b.boards}</td><td>${fmt(b.sums)}</td><td>${fmt(b.pPositions)}</td><td>${b.mismatches}</td></tr>`).join('') +
    '</table><p class="fine">n empty boards: ' +
    r.emptyBoards.map((e) => `${e.n} → ${e.value}${e.p ? ' (P)' : ''}`).join(', ') +
    '. An even number of empty boards is a second-player win.</p>';
  $('checks').innerHTML =
    '<ul class="checks">' +
    r.claims
      .map((c) => `<li><span class="${c.ok === null ? 'ng' : c.ok ? 'ok' : 'ng'}">${c.ok === null ? '—' : c.ok ? '✓' : '✗'}</span> ${c.claim}<br><span class="fine">${c.result}</span></li>`)
      .join('') +
    '</ul>';
}

$('newgame').addEventListener('click', newGame);
$('undo').addEventListener('click', undo);
hintsBox.addEventListener('change', render);
nSel.addEventListener('change', newGame);
youSel.addEventListener('change', newGame);
renderStatic();
newGame();
