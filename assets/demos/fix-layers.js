// Where each fix landed, and whether the slip came back, for the agents post.
// It replaces <img data-demo="fix-layers">. That image is chartSVG(720, 330): all four cases
// at once, so the terminal (/) and the feed still show which fixes moved into code.
// The reader picks one case; the chart draws its path and the list below tells it day by day.
//
// Facts come from the nightly retro log (LESSONS.md) and the scripts it produced, Oct 15–26.

export const LAYERS = ['1 code', '2 CI', '3 rules', '4 review'];
// kind: slip (it went wrong), fix (a fix landed), held (checked, it works), plan (proposed only)
export const CASES = [
  {
    id: 'spawn', name: 'Starting an agent', color: '#79c0ff',
    outcome: 'Moved into code on day two. Every later fix went into the same command.',
    events: [
      ['2026-10-16', 3, 'slip', 'The steps live in the skill file; the leader runs about 6 by hand per agent. 2 of 12 new agents miss a review dialog.'],
      ['2026-10-16', 1, 'fix', 'spawn_agent.sh does every step in one command.'],
      ['2026-10-17', 1, 'fix', 'It checks the account before starting.'],
      ['2026-10-21', 1, 'fix', 'It adds a startup check and the hands-on rules to every task.'],
      ['2026-10-22', 1, 'fix', 'The agent quota is a lock (flock), so two spawns at once cannot both take the last slot.'],
      ['2026-10-25', 1, 'fix', 'It checks the account balance and can isolate the data paths.'],
    ],
  },
  {
    id: 'startup', name: 'Did it start?', color: '#7ee787',
    outcome: 'Moved into code the next day, and checked against the day it came from.',
    events: [
      ['2026-10-20', 3, 'slip', '16 new agents. The leader checks 6 of them by hand, about 65 s each.'],
      ['2026-10-21', 1, 'fix', 'startup_check.py runs inside spawn: resend Enter if the first prompt did not land, stop on a login or trust screen.'],
      ['2026-10-21', 1, 'held', 'Replayed on the 16 agents of Oct 20: 13 pass on their own, the rest take 5 s instead of 65 s.'],
    ],
  },
  {
    id: 'readonly', name: '"Read-only"', color: '#ffa657',
    outcome: 'Proposed for code, landed as words, broken the same day. Still open.',
    events: [
      ['2026-10-23', 3, 'slip', 'The task says read-only. The agent writes live data 3 times; one write migrates the live mnemo index and nothing is indexed for about 20 min.'],
      ['2026-10-23', 1, 'plan', 'The retro proposes isolation in code instead of words.'],
      ['2026-10-25', 3, 'fix', '--isolate lands, but only as a paragraph in the prompt.'],
      ['2026-10-25', 3, 'slip', 'The agent building --isolate writes a live snapshot in its own smoke test.'],
    ],
  },
  {
    id: 'progress', name: 'Progress notes', color: '#d2a8ff',
    outcome: 'Still words: a tool nobody is made to use. Too early to tell.',
    events: [
      ['2026-10-16', 3, 'fix', 'progress.py lands. Using it is up to the leader.'],
      ['2026-10-23', 3, 'slip', 'A new leader edits the progress file by hand about 40 times.'],
      ['2026-10-25', 3, 'fix', 'The skill now says: always use progress.py, and gives the exact command.'],
    ],
  },
];
const FIRST = '2026-10-15';
const DAYS = 12;

const C = { surface: '#11151d', grid: '#262c36', axis: '#8b949e', text: '#d6dde6', dim: '#3a4250', slip: '#ff7b72', fix: '#79c0ff', held: '#7ee787' };
const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PAD = { top: 20, right: 18, bottom: 30, left: 78 };
const r1 = (n) => Math.round(n * 10) / 10;
const dayIndex = (d) => Math.round((Date.parse(d) - Date.parse(FIRST)) / 864e5);
const label = (d) => `${+d.slice(5, 7)}/${+d.slice(8)}`;

function scales(width, height) {
  const w = width - PAD.left - PAD.right;
  const row = (height - PAD.top - PAD.bottom) / LAYERS.length;
  return {
    row,
    x: (d) => PAD.left + (w / DAYS) * (dayIndex(d) + 0.5),
    // Cases sit a little apart inside a row so two dots on the same day and layer never cover each other.
    y: (layer, c) => PAD.top + row * (layer - 0.5) + (c - 1.5) * Math.min(7, row / 8),
  };
}

// One case: a solid path through what really happened, a dashed spur to a proposal.
function track(s, c, k, { active = true, faded = false } = {}) {
  const col = faded ? C.dim : CASES[c].color;
  // A second event on the same day and layer sits just right of the first, so both dots show.
  const seen = {};
  const at = CASES[c].events.map((e) => {
    const key = e[0] + e[1];
    seen[key] = (seen[key] ?? -1) + 1;
    return [s.x(e[0]) + seen[key] * 11, s.y(e[1], c)];
  });
  const pts = at.filter((_, i) => CASES[c].events[i][2] !== 'plan');
  let out = pts.length > 1 ? `<path d="M${pts.map((p) => p.map(r1).join(',')).join('L')}" fill="none" stroke="${col}" stroke-width="${active ? 2.5 : 1.5}" stroke-linejoin="round"/>` : '';
  CASES[c].events.forEach((e, i) => {
    const [x, y] = at[i];
    if (e[2] === 'plan') {
      out += `<path d="M${at[i - 1].map(r1).join(',')}L${r1(x)},${r1(y)}" stroke="${col}" stroke-width="1.5" stroke-dasharray="4 4" fill="none"/>`;
      out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="5" fill="${C.surface}" stroke="${col}" stroke-width="2" data-k="${k}-${i}"/>`;
    } else {
      const fill = faded ? C.dim : C[e[2]];
      out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${active ? 5.5 : 4}" fill="${fill}" stroke="${C.surface}" stroke-width="2" data-k="${k}-${i}"/>`;
    }
  });
  return out;
}

// sel: the case drawn in full (null draws all four in their own colors, for the static image).
export function chartSVG(width, height, sel = null) {
  const s = scales(width, height);
  const narrow = width < 480;
  const grid = LAYERS.map((name, i) => {
    const y = PAD.top + s.row * i;
    return `<rect x="${PAD.left}" y="${r1(y + 2)}" width="${width - PAD.left - PAD.right}" height="${r1(s.row - 4)}" rx="4" fill="${i === 0 ? '#14202e' : '#151a23'}"/>
<text x="${PAD.left - 10}" y="${r1(y + s.row / 2 + 4)}" text-anchor="end" fill="${i === 0 ? C.text : C.axis}"${i === 0 ? ' font-weight="700"' : ''}>${name}</text>`;
  }).join('\n');
  const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.parse(FIRST) + i * 864e5).toISOString().slice(0, 10));
  const ticks = days.map((d, i) => (narrow && i % 2 ? '' : `<text x="${r1(s.x(d))}" y="${height - 10}" text-anchor="middle" fill="${C.axis}">${label(d)}</text>`)).join('');
  const order = sel == null ? CASES.map((_, c) => c) : [...CASES.keys()].filter((c) => c !== sel).concat(sel);
  const tracks = order.map((c) => track(s, c, c, { active: sel == null || c === sel, faded: sel != null && c !== sel })).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family='${FONT}' font-size="12">
<rect width="${width}" height="${height}" rx="6" fill="${C.surface}"/>
${grid}
${ticks}
${tracks}
</svg>`;
}

// The static image also needs a key, since the terminal and the feed cannot click.
export function staticSVG(width) {
  const chartH = 300, keyH = 74;
  const chart = chartSVG(width, chartH).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  let x = PAD.left, y = chartH + 18;
  const names = CASES.map((c) => {
    const w = 22 + c.name.length * 7.2 + 20;
    if (x + w > width - PAD.right) { x = PAD.left; y += 20; }
    const g = `<line x1="${r1(x)}" x2="${r1(x + 14)}" y1="${y - 4}" y2="${y - 4}" stroke="${c.color}" stroke-width="2.5"/><text x="${r1(x + 20)}" y="${y}" fill="${C.text}">${c.name.replace(/"/g, '&quot;')}</text>`;
    x += w;
    return g;
  }).join('');
  const kinds = [['slip', 'went wrong'], ['fix', 'fix landed'], ['held', 'checked, works']];
  x = PAD.left; y += 22;
  const dots = kinds.map(([k, t]) => {
    const g = `<circle cx="${r1(x + 5)}" cy="${y - 4}" r="5" fill="${C[k]}"/><text x="${r1(x + 15)}" y="${y}" fill="${C.axis}">${t}</text>`;
    x += 15 + t.length * 7.2 + 18;
    return g;
  }).join('') + `<circle cx="${r1(x + 5)}" cy="${y - 4}" r="4.5" fill="none" stroke="${C.axis}" stroke-width="1.5"/><text x="${r1(x + 15)}" y="${y}" fill="${C.axis}">proposed</text>`;
  const h = chartH + keyH;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" font-family='${FONT}' font-size="12">
<rect width="${width}" height="${h}" rx="6" fill="${C.surface}"/>${chart}
${names}
${dots}
</svg>`;
}

const CSS = `
.fxl { margin: 0 0 1em; }
.fxl-cases { display: flex; flex-wrap: wrap; gap: .5em; margin-bottom: .6em; }
.fxl-cases button { font: inherit; font-size: .9em; color: var(--dim); background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: .2em .9ch; cursor: pointer; }
.fxl-cases button[aria-pressed="true"] { color: var(--fg); border-color: var(--c); box-shadow: inset 3px 0 0 var(--c); }
.fxl-plot svg { display: block; width: 100%; height: auto; }
.fxl ol { list-style: none; margin: .7em 0 0; padding: 0; font-size: .9em; }
.fxl li { display: grid; grid-template-columns: 6ch 1.2em 1fr; gap: 0 .6ch; padding: .2em 0; border-bottom: 1px solid var(--line); }
.fxl li time { color: var(--dim); font-variant-numeric: tabular-nums; }
.fxl li .k { font-weight: 700; }
.fxl li.slip .k { color: #ff7b72; } .fxl li.fix .k { color: #79c0ff; } .fxl li.held .k { color: #7ee787; } .fxl li.plan .k { color: var(--dim); }
.fxl li.on { background: var(--bg-2); }
.fxl .out { margin: .6em 0 0; color: var(--fg); }
`;
const MARK = { slip: '×', fix: '+', held: '✓', plan: '○' };

function demo(img) {
  if (!document.getElementById('fxl-css')) {
    const style = document.createElement('style');
    style.id = 'fxl-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const holder = img.closest('p') || img;
  const fig = document.createElement('figure');
  fig.className = 'fxl';
  fig.innerHTML = `<div class="fxl-cases" role="group" aria-label="Pick a slip"></div><div class="fxl-plot" role="img"></div><ol></ol><p class="out"></p>`;
  const plot = fig.querySelector('.fxl-plot');
  const list = fig.querySelector('ol');
  const out = fig.querySelector('.out');
  const buttons = CASES.map((c, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.name;
    b.style.setProperty('--c', c.color);
    b.addEventListener('click', () => pick(k));
    fig.querySelector('.fxl-cases').append(b);
    return b;
  });

  let sel = 2;
  let width = 0;
  function draw() {
    width = Math.round(plot.clientWidth);
    if (!width) return;
    plot.innerHTML = chartSVG(width, width < 480 ? 230 : 280, sel);
    plot.setAttribute('aria-label', `${img.alt} Showing: ${CASES[sel].name}.`);
  }
  function mark(i, on) {
    const dot = plot.querySelector(`[data-k="${sel}-${i}"]`);
    if (dot) dot.setAttribute('r', on ? 8 : 5.5);
  }
  function pick(k) {
    sel = k;
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
    draw();
    list.innerHTML = '';
    CASES[k].events.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = e[2];
      li.innerHTML = `<time datetime="${e[0]}">${label(e[0])}</time><span class="k" aria-hidden="true">${MARK[e[2]]}</span><span></span>`;
      li.lastChild.textContent = `${LAYERS[e[1] - 1].replace(/^\d /, `layer ${e[1]}, `)}: ${e[3]}`;
      li.addEventListener('pointerenter', () => { li.classList.add('on'); mark(i, true); });
      li.addEventListener('pointerleave', () => { li.classList.remove('on'); mark(i, false); });
      list.append(li);
    });
    out.textContent = CASES[k].outcome;
  }

  holder.after(fig);
  holder.hidden = true;
  pick(sel);
  new ResizeObserver(() => Math.round(plot.clientWidth) !== width && draw()).observe(plot);
}

if (typeof document !== 'undefined') document.querySelectorAll('img[data-demo="fix-layers"]').forEach(demo);
