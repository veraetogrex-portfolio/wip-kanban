// WIP Kanban — github.com/veraetogrex-portfolio · zero dependencies
// A board whose "In progress" column holds at most 3 cards. Drag a fourth in and the
// column pushes back like a full lift; finish one and the slot opens.

const root    = document.querySelector('#board');
const board   = root.querySelector('.wk-board');
const caption = root.querySelector('.wk-caption');
const cols    = Object.fromEntries([...root.querySelectorAll('.wk-col')].map(el => [el.dataset.col, {
  el, chip: el.querySelector('.wk-chip'), limit: +el.dataset.limit || Infinity, x: el.offsetLeft,
}]));

const START = {
  todo:  [['Onboarding emails', 'VX-214', '#ff6fb5'], ['Search filters', 'VX-219', '#ffb547'], ['Team invites', 'VX-221', '#a69bff']],
  doing: [['Billing page', 'VX-198', '#3fe0d0'], ['Export to CSV', 'VX-203', '#ffb547'], ['Push alerts', 'VX-207', '#ff6fb5']],
  done:  [['Login flow', 'VX-176', '#a69bff'], ['Avatar upload', 'VX-181', '#3fe0d0']],
};
const TOP = 74, STEP = 100, PAD = 20, PULL = .22;           // first card y, card pitch, column padding, rubber band

const cards = {};                                          // id → { el, col }
let model, drag = null;

for (const col of Object.keys(START)) for (const [title, id, dot] of START[col]) {
  const el = document.createElement('div');
  el.className = 'wk-card'; el.dataset.id = id; el.style.setProperty('--dot', dot);
  el.innerHTML = `<b>${title}</b><span>${id}</span>`;
  board.appendChild(el); cards[id] = { el };
  el.addEventListener('pointerdown', e => grab(e, id));
}

function reset() {
  model = Object.fromEntries(Object.entries(START).map(([c, list]) => [c, list.map(x => x[1])]));
  for (const id in cards) cards[id].el.classList.toggle('is-done', model.done.includes(id));
  drag = null; layout(); say('Three in progress. Try to start a fourth.'); root.classList.remove('is-done');
}

// place every card from the model; a hovered slot opens a gap
function layout(gap) {
  for (const [c, list] of Object.entries(model)) {
    let k = 0;
    for (const id of list) {
      if (drag && id === drag.id) continue;
      if (gap && gap.col === c && gap.at === k) k++;
      move(id, cols[c].x + PAD, TOP + k * STEP); k++;
    }
  }
  for (const [c, col] of Object.entries(cols)) {
    const n = model[c].length;
    col.chip.textContent = col.limit < Infinity ? `${n} / ${col.limit}` : n;
    col.chip.classList.toggle('is-free', col.limit < Infinity && n < col.limit);
  }
}
const move = (id, x, y) => { const c = cards[id]; c.x = x; c.y = y; c.el.style.transform = `translate(${x}px,${y}px)`; };

function say(text, tone = '') { caption.textContent = text; caption.className = 'wk-caption' + (tone ? ' is-' + tone : ''); }

// pointer → board coordinates (works inside zoom and scaled stages)
function local(e) { const r = board.getBoundingClientRect(), k = r.width / board.offsetWidth; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; }
const colAt = x => Object.keys(cols).find(c => x >= cols[c].x - 16 && x <= cols[c].x + 388);
const room  = c => model[c].filter(id => id !== drag.id).length < cols[c].limit;

function grab(e, id) {
  const [x, y] = local(e), c = cards[id];
  const from = Object.keys(model).find(k => model[k].includes(id));
  drag = { id, from, dx: x - c.x, dy: y - c.y };
  c.el.classList.add('is-drag');
  addEventListener('pointermove', over); addEventListener('pointerup', drop, { once: true });
  drag.to = { col: from, at: model[from].indexOf(id) };
  layout(drag.to);                                        // its slot stays open until it lands somewhere
}

function over(e) {
  if (!drag) return;
  let [x, y] = local(e); x -= drag.dx; y -= drag.dy;
  const target = colAt(x + 166);
  Object.values(cols).forEach(c => c.el.classList.remove('is-full', 'is-open'));
  if (target && target !== drag.from && !room(target)) {
    // a full column pushes back: the card only gets a fraction of the way in
    const edge = cols[target].x - 300;
    if (x > edge) x = edge + (x - edge) * PULL;
    cols[target].el.classList.add('is-full');
    say('In progress is full. Finish something first.', 'bad');
    layout({ col: drag.from, at: model[drag.from].indexOf(drag.id) });
  } else if (target) {
    const at = Math.max(0, Math.min(model[target].filter(i => i !== drag.id).length, Math.round((y - TOP) / STEP)));
    if (target !== drag.from) cols[target].el.classList.add('is-open');
    layout({ col: target, at });
    drag.to = { col: target, at };
  }
  drag.full = target && target !== drag.from && !room(target);
  move(drag.id, x, y);
  cards[drag.id].el.style.transform += ` rotate(${drag.full ? -3 : 2}deg) scale(1.03)`;
}

function drop() {
  removeEventListener('pointermove', over);
  if (!drag) return;
  const { id, from, to, full } = drag, el = cards[id].el;
  el.classList.remove('is-drag');
  Object.values(cols).forEach(c => c.el.classList.remove('is-full', 'is-open'));
  drag = null;
  if (full || !to) { layout(); return; }                     // springs back to where it was
  model[from] = model[from].filter(i => i !== id);
  model[to.col].splice(to.at, 0, id);
  el.classList.toggle('is-done', to.col === 'done');
  layout();
  if (to.col === 'done' && from !== 'done') { confetti(id); say('Done. A slot just opened.', 'good'); }
  if (to.col === 'doing' && from !== 'doing') { say('In. Still three at a time.', 'good'); if (model.done.length > 2) root.classList.add('is-done'); }
}

function confetti(id) {
  const c = cards[id], colors = ['#3fe0d0', '#a69bff', '#ff6fb5', '#ffb547'];
  for (let k = 0; k < 22; k++) {
    const s = document.createElement('i'); s.className = 'wk-confetti';
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, d = 90 + Math.random() * 120;
    s.style.left = c.x + 166 + 'px'; s.style.top = c.y + 44 + 'px'; s.style.background = colors[k % 4];
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 60 + 'px'); s.style.setProperty('--r', (Math.random() * 540 - 270) + 'deg');
    board.appendChild(s); setTimeout(() => s.remove(), 950);
  }
}

reset();
root.kanban = { reset, card: id => cards[id].el, col: c => cols[c].el };   // for scripted demos
