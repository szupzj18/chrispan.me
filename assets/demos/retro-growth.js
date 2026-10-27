// What the nightly retro has grown so far, for the agents post.
// It replaces <img data-demo="retro-growth">. That image is chartSVG(720, 300, 'layer'), so the
// terminal (/) and the feed show the same chart without the hover layer and the switch.
//
// ITEMS: the 98 capabilities that came out of the retros of Oct 15–25, one row per
// [day it was first written down, layer the fix sits on (0 = unclear), status on Oct 25, how many].
// Layer and status are as recorded in the retro log and checked against the scripts and skill files.

export const ITEMS = [
  ['2026-10-15', 1, 0, 4], ['2026-10-15', 1, 1, 1], ['2026-10-15', 2, 0, 2], ['2026-10-15', 3, 0, 6],
  ['2026-10-15', 3, 2, 2], ['2026-10-16', 0, 2, 1], ['2026-10-16', 1, 0, 7], ['2026-10-16', 3, 0, 11],
  ['2026-10-16', 3, 2, 1], ['2026-10-17', 2, 0, 1], ['2026-10-17', 2, 1, 1], ['2026-10-17', 4, 2, 1],
  ['2026-10-18', 1, 2, 1], ['2026-10-18', 3, 1, 2], ['2026-10-18', 3, 2, 1], ['2026-10-18', 4, 2, 3],
  ['2026-10-19', 1, 0, 1], ['2026-10-19', 1, 2, 4], ['2026-10-19', 1, 3, 1], ['2026-10-19', 2, 3, 1],
  ['2026-10-19', 3, 0, 4], ['2026-10-19', 3, 2, 1], ['2026-10-19', 4, 2, 1], ['2026-10-20', 1, 2, 2],
  ['2026-10-20', 3, 0, 2], ['2026-10-20', 3, 1, 1], ['2026-10-20', 3, 2, 1], ['2026-10-20', 4, 2, 2],
  ['2026-10-21', 1, 0, 5], ['2026-10-21', 1, 1, 2], ['2026-10-21', 3, 1, 1], ['2026-10-21', 3, 2, 2],
  ['2026-10-21', 4, 2, 1], ['2026-10-22', 1, 0, 2], ['2026-10-22', 1, 1, 1], ['2026-10-22', 2, 0, 2],
  ['2026-10-22', 3, 0, 1], ['2026-10-22', 3, 3, 1], ['2026-10-22', 4, 1, 1], ['2026-10-23', 1, 0, 1],
  ['2026-10-23', 3, 0, 1], ['2026-10-24', 1, 0, 1], ['2026-10-24', 3, 0, 2], ['2026-10-25', 1, 0, 4],
  ['2026-10-25', 3, 0, 3], ['2026-10-25', 3, 1, 1],
];

export const VIEWS = {
  layer: { title: 'by layer', keys: [[1, '1 code', '#79c0ff'], [2, '2 CI', '#56d4dd'], [3, '3 rules', '#d2a8ff'], [4, '4 review', '#8b949e'], [0, 'unclear', '#3a4250']], col: 1 },
  status: { title: 'by status', keys: [[0, 'landed', '#7ee787'], [1, 'partly', '#e3b341'], [2, 'pending', '#8b949e'], [3, 'other', '#ff7b72']], col: 2 },
};
const FIRST = '2026-10-15';
const DAYS = 11;

const C = { surface: '#11151d', grid: '#262c36', axis: '#8b949e', text: '#d6dde6', hi: '#e3b341' };
const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PAD = { top: 52, right: 16, bottom: 30, left: 40 };
const Y_MAX = 100;
const Y_TICKS = [0, 25, 50, 75, 100];
const r1 = (n) => Math.round(n * 10) / 10;
const dayIndex = (d) => Math.round((Date.parse(d) - Date.parse(FIRST)) / 864e5);
const dayOf = (i) => new Date(Date.parse(FIRST) + i * 864e5).toISOString().slice(0, 10);
const short = (i) => `${+dayOf(i).slice(5, 7)}/${+dayOf(i).slice(8)}`;

// cum[i][key]: capabilities written down by the end of day i, split by the view's key.
export function cumulative(view) {
  const { keys, col } = VIEWS[view];
  const cum = [];
  for (let i = 0; i < DAYS; i++) {
    const row = Object.fromEntries(keys.map(([k]) => [k, 0]));
    for (const it of ITEMS) if (dayIndex(it[0]) <= i) row[it[col]] += it[3];
    cum.push(row);
  }
  return cum;
}
const born = (i) => ITEMS.filter((it) => dayIndex(it[0]) === i).reduce((n, it) => n + it[3], 0);

function scales(width, height) {
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const slot = w / DAYS;
  return {
    slot,
    bar: Math.min(36, slot * 0.68),
    cx: (i) => PAD.left + slot * (i + 0.5),
    y: (v) => PAD.top + h - (v / Y_MAX) * h,
    index: (px) => Math.max(0, Math.min(DAYS - 1, Math.floor((px - PAD.left) / slot))),
  };
}

export function chartSVG(width, height, view = 'layer') {
  const s = scales(width, height);
  const narrow = width < 480;
  const { keys } = VIEWS[view];
  const cum = cumulative(view);
  const bars = cum.map((row, i) => {
    let v = 0;
    return keys.map(([k, , color]) => {
      if (!row[k]) return '';
      const y0 = s.y(v), y1 = s.y((v += row[k]));
      return `<rect x="${r1(s.cx(i) - s.bar / 2)}" y="${r1(y1)}" width="${r1(s.bar)}" height="${r1(y0 - y1)}" fill="${color}"/>`;
    }).join('');
  }).join('\n');
  let lx = PAD.left;
  // A key that would run off the right edge is left out (on a phone: 'unclear', 1 item; the tooltip still names it).
  const legend = keys.map(([, name, color]) => {
    if (lx + 15 + name.length * 7.2 > width - PAD.right) return '';
    const g = `<rect x="${r1(lx)}" y="${PAD.top - 40}" width="10" height="10" rx="2" fill="${color}"/><text x="${r1(lx + 15)}" y="${PAD.top - 31}" fill="${C.text}">${name}</text>`;
    lx += 15 + name.length * 7.2 + (narrow ? 10 : 18);
    return g;
  }).join('');
  const last = cum[DAYS - 1], tot = Object.values(last).reduce((a, b) => a + b, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family='${FONT}' font-size="12">
<rect width="${width}" height="${height}" rx="6" fill="${C.surface}"/>
${legend}
${Y_TICKS.map((v) => `<line x1="${PAD.left}" x2="${width - PAD.right}" y1="${r1(s.y(v))}" y2="${r1(s.y(v))}" stroke="${C.grid}" stroke-width="1"/>
<text x="${PAD.left - 8}" y="${r1(s.y(v) + 4)}" text-anchor="end" fill="${C.axis}">${v}</text>`).join('\n')}
${bars}
${Array.from({ length: DAYS }, (_, i) => (narrow && i % 2 ? '' : `<text x="${r1(s.cx(i))}" y="${height - 10}" text-anchor="middle" fill="${C.axis}">${short(i)}</text>`)).join('')}
<text x="${r1(s.cx(DAYS - 1))}" y="${r1(s.y(tot) - 8)}" text-anchor="middle" fill="${C.text}">${tot}</text>
</svg>`;
}

const CSS = `
.rgr { position: relative; margin: 0 0 1em; }
.rgr-views { display: flex; gap: .5em; margin-bottom: .6em; }
.rgr-views button { font: inherit; font-size: .9em; color: var(--dim); background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: .2em .9ch; cursor: pointer; }
.rgr-views button[aria-pressed="true"] { color: var(--fg); border-color: var(--dim); }
.rgr-plot { position: relative; outline-offset: 3px; touch-action: pan-y; cursor: crosshair; }
.rgr-plot svg { display: block; width: 100%; height: auto; }
.rgr-tip { position: absolute; top: 56px; pointer-events: none; padding: .3em .8ch; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); font-size: .85em; line-height: 1.5; white-space: nowrap; }
.rgr-tip b { color: var(--fg); font-variant-numeric: tabular-nums; }
.rgr-tip span { display: block; color: var(--dim); }
.rgr-tip i { font-style: normal; display: inline-block; width: .8em; height: .8em; border-radius: 2px; margin-right: .6ch; vertical-align: -.05em; }
`;

function demo(img) {
  if (!document.getElementById('rgr-css')) {
    const style = document.createElement('style');
    style.id = 'rgr-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const holder = img.closest('p') || img;
  const fig = document.createElement('figure');
  fig.className = 'rgr';
  fig.innerHTML = `<div class="rgr-views" role="group" aria-label="Color the bars"></div><div class="rgr-plot" tabindex="0" role="img"></div><div class="sr" aria-live="polite"></div>`;
  const plot = fig.querySelector('.rgr-plot');
  const live = fig.querySelector('[aria-live]');
  let view = 'layer';
  const buttons = Object.entries(VIEWS).map(([v, { title }]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = title;
    b.addEventListener('click', () => {
      view = v;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      size.w = 0;
      redraw();
    });
    fig.querySelector('.rgr-views').append(b);
    return b;
  });
  buttons[0].setAttribute('aria-pressed', 'true');

  let size = { w: 0, h: 0 };
  let s = null;
  let cur = DAYS - 1;
  let hover = null;

  function draw() {
    const w = Math.round(plot.clientWidth);
    if (!w || w === size.w) return;
    size = { w, h: w < 480 ? 250 : 300 };
    s = scales(size.w, size.h);
    plot.innerHTML = chartSVG(size.w, size.h, view).replace('</svg>', `<rect class="rgr-hover" visibility="hidden" y="${PAD.top - 22}" height="${r1(s.y(0) - PAD.top + 26)}" rx="4" fill="none" stroke="${C.hi}" stroke-width="1.5"/></svg>`);
    plot.setAttribute('aria-label', `${img.alt} Colored ${VIEWS[view].title}. Left and right arrow keys step through the days.`);
    const tip = document.createElement('div');
    tip.className = 'rgr-tip';
    tip.hidden = true;
    plot.append(tip);
    hover = { box: plot.querySelector('.rgr-hover'), tip };
  }
  function redraw() {
    const shown = hover && !hover.tip.hidden;
    draw();
    if (shown) show(cur);
  }

  function show(i) {
    cur = i;
    const row = cumulative(view)[i];
    const tot = Object.values(row).reduce((a, b) => a + b, 0);
    const w = s.bar + 10;
    hover.box.setAttribute('visibility', 'visible');
    hover.box.setAttribute('x', r1(s.cx(i) - w / 2));
    hover.box.setAttribute('width', r1(w));
    hover.tip.innerHTML = `<b>${tot}</b> by ${dayOf(i).slice(5).replace('-', '/')} <span>+${born(i)} that day</span>` +
      VIEWS[view].keys.filter(([k]) => row[k]).map(([k, name, color]) => `<span><i style="background:${color}"></i>${name} ${row[k]}</span>`).join('');
    hover.tip.hidden = false;
    const x = s.cx(i);
    const left = x / size.w > 0.55 ? x - w / 2 - hover.tip.offsetWidth - 6 : x + w / 2 + 6;
    hover.tip.style.left = `${(Math.max(0, left) / size.w) * 100}%`;
  }
  function hide() {
    hover.box.setAttribute('visibility', 'hidden');
    hover.tip.hidden = true;
  }

  const at = (e) => s.index(((e.clientX - plot.getBoundingClientRect().left) / plot.clientWidth) * size.w);
  plot.addEventListener('pointermove', (e) => show(at(e)));
  plot.addEventListener('pointerdown', (e) => show(at(e)));
  plot.addEventListener('pointerleave', () => document.activeElement !== plot && hide());
  plot.addEventListener('focus', () => show(cur));
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (e.key === 'Escape') return hide();
    if (!(e.key in moves)) return;
    e.preventDefault();
    show(Math.max(0, Math.min(DAYS - 1, cur + moves[e.key])));
    live.textContent = hover.tip.textContent;
  });

  holder.after(fig);
  holder.hidden = true;
  draw();
  new ResizeObserver(redraw).observe(plot);
}

if (typeof document !== 'undefined') document.querySelectorAll('img[data-demo="retro-growth"]').forEach(demo);
