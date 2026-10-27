// Interactive chart of agent sessions started per day, for the agents post.
// It replaces <img data-demo="agent-sessions">. That image is chartSVG(720, 300), so the
// terminal (/) and the feed show the same chart without the hover layer.
//
// DAYS counts sessions started on this machine per day (Asia/Shanghai), by agent, as
// listed by `mnemo recent` on 2026-10-27. Other = Pi, Grok and Antigravity CLI.

export const DAYS = [
  ['2026-10-15', 6, 7, 1], ['2026-10-16', 22, 16, 2], ['2026-10-17', 9, 4, 0], ['2026-10-18', 9, 1, 0],
  ['2026-10-19', 27, 2, 3], ['2026-10-20', 26, 1, 2], ['2026-10-21', 54, 2, 1], ['2026-10-22', 66, 10, 0],
  ['2026-10-23', 17, 5, 1], ['2026-10-24', 10, 4, 0], ['2026-10-25', 16, 1, 0], ['2026-10-26', 23, 4, 5],
];
export const AGENTS = [['Claude Code', '#3987e5'], ['Codex', '#56d4dd'], ['Pi, Grok, …', '#d2a8ff']];

const C = { surface: '#11151d', grid: '#262c36', axis: '#8b949e', text: '#d6dde6', hi: '#e3b341' };
const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PAD = { top: 52, right: 16, bottom: 30, left: 40 };
const Y_MAX = 80;
const Y_TICKS = [0, 20, 40, 60, 80];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const total = (d) => d[1] + d[2] + d[3];
const sum = DAYS.reduce((n, d) => n + total(d), 0);
const peak = DAYS.reduce((p, d, i) => (total(d) > total(DAYS[p]) ? i : p), 0);
const short = (d) => `${+d[0].slice(5, 7)}/${+d[0].slice(8)}`;
const long = (d) => `Oct ${+d[0].slice(8)}, ${WEEKDAY[new Date(d[0] + 'T12:00:00Z').getUTCDay()]}`;
const r1 = (n) => Math.round(n * 10) / 10;

function scales(width, height) {
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const slot = w / DAYS.length;
  return {
    slot,
    bar: Math.min(34, slot * 0.66),
    cx: (i) => PAD.left + slot * (i + 0.5),
    y: (v) => PAD.top + h - (v / Y_MAX) * h,
    index: (px) => Math.max(0, Math.min(DAYS.length - 1, Math.floor((px - PAD.left) / slot))),
  };
}

export function chartSVG(width, height) {
  const s = scales(width, height);
  const narrow = width < 480;
  const bars = DAYS.map((d, i) => {
    let v = 0;
    return AGENTS.map(([, color], k) => {
      const n = d[k + 1];
      if (!n) return '';
      const y0 = s.y(v), y1 = s.y((v += n));
      return `<rect x="${r1(s.cx(i) - s.bar / 2)}" y="${r1(y1)}" width="${r1(s.bar)}" height="${r1(y0 - y1)}" fill="${color}"/>`;
    }).join('');
  }).join('\n');
  let lx = PAD.left;
  const legend = AGENTS.map(([name, color]) => {
    const g = `<rect x="${r1(lx)}" y="${PAD.top - 40}" width="10" height="10" rx="2" fill="${color}"/><text x="${r1(lx + 15)}" y="${PAD.top - 31}" fill="${C.text}">${name.replace('…', '&#8230;')}</text>`;
    lx += 15 + name.length * 7.2 + 18;
    return g;
  }).join('');
  const px = s.cx(peak), py = s.y(total(DAYS[peak]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family='${FONT}' font-size="12">
<rect width="${width}" height="${height}" rx="6" fill="${C.surface}"/>
${legend}
${Y_TICKS.map((v) => `<line x1="${PAD.left}" x2="${width - PAD.right}" y1="${r1(s.y(v))}" y2="${r1(s.y(v))}" stroke="${C.grid}" stroke-width="1"/>
<text x="${PAD.left - 8}" y="${r1(s.y(v) + 4)}" text-anchor="end" fill="${C.axis}">${v}</text>`).join('\n')}
${bars}
${DAYS.map((d, i) => (narrow && i % 2 ? '' : `<text x="${r1(s.cx(i))}" y="${height - 10}" text-anchor="middle" fill="${C.axis}">${short(d)}</text>`)).join('')}
<text x="${r1(px)}" y="${r1(py - 8)}" text-anchor="middle" fill="${C.text}">${total(DAYS[peak])}</text>
<text x="${width - PAD.right}" y="${PAD.top - 31}" text-anchor="end" fill="${C.axis}">${narrow ? '' : `${sum} in ${DAYS.length} days`}</text>
</svg>`;
}

const CSS = `
.ags { position: relative; margin: 0 0 1em; }
.ags-plot { position: relative; outline-offset: 3px; touch-action: pan-y; cursor: crosshair; }
.ags-plot svg { display: block; width: 100%; height: auto; }
.ags-tip { position: absolute; top: 56px; pointer-events: none; padding: .3em .8ch; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); font-size: .85em; line-height: 1.5; white-space: nowrap; }
.ags-tip b { color: var(--fg); font-variant-numeric: tabular-nums; }
.ags-tip span { display: block; color: var(--dim); }
.ags details { margin-top: .5em; color: var(--dim); font-size: .9em; }
.ags summary { cursor: pointer; }
.ags-table { overflow-x: auto; margin-top: .5em; }
.ags table { border-collapse: collapse; font-size: .85em; font-variant-numeric: tabular-nums; }
.ags th, .ags td { padding: .15em .8ch; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }
.ags th { color: var(--dim); font-weight: 400; }
.ags td { color: var(--fg); }
`;

function demo(img) {
  if (!document.getElementById('ags-css')) {
    const style = document.createElement('style');
    style.id = 'ags-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const holder = img.closest('p') || img;
  const fig = document.createElement('figure');
  fig.className = 'ags';
  fig.innerHTML = `<div class="ags-plot" tabindex="0" role="img"></div>
<div class="sr" aria-live="polite"></div>
<details><summary>Every day</summary><div class="ags-table"><table></table></div></details>`;
  const plot = fig.querySelector('.ags-plot');
  const live = fig.querySelector('[aria-live]');
  plot.setAttribute('aria-label', `${img.alt}. Left and right arrow keys step through the days.`);

  const table = fig.querySelector('table');
  const head = table.insertRow();
  for (const t of ['', ...AGENTS.map((a) => a[0]), 'Total']) head.appendChild(document.createElement('th')).textContent = t;
  for (const d of DAYS) {
    const row = table.insertRow();
    row.appendChild(document.createElement('th')).textContent = long(d);
    for (const v of [d[1], d[2], d[3], total(d)]) row.insertCell().textContent = v;
  }

  let size = { w: 0, h: 0 };
  let s = null;
  let cur = peak;
  let hover = null;

  function draw() {
    const w = Math.round(plot.clientWidth);
    if (!w || w === size.w) return;
    size = { w, h: w < 480 ? 250 : 300 };
    s = scales(size.w, size.h);
    plot.innerHTML = chartSVG(size.w, size.h).replace('</svg>', `<rect class="ags-hover" visibility="hidden" y="${PAD.top - 22}" height="${r1(s.y(0) - PAD.top + 26)}" rx="4" fill="none" stroke="${C.hi}" stroke-width="1.5"/></svg>`);
    const tip = document.createElement('div');
    tip.className = 'ags-tip';
    tip.hidden = true;
    tip.append(document.createElement('b'), ' sessions', document.createElement('span'), document.createElement('span'));
    plot.append(tip);
    hover = { box: plot.querySelector('.ags-hover'), tip };
  }

  function show(i) {
    cur = i;
    const d = DAYS[i];
    const w = s.bar + 10;
    hover.box.setAttribute('visibility', 'visible');
    hover.box.setAttribute('x', r1(s.cx(i) - w / 2));
    hover.box.setAttribute('width', r1(w));
    const [b, when, split] = hover.tip.children;
    b.textContent = total(d);
    when.textContent = long(d);
    split.textContent = AGENTS.map((a, k) => (d[k + 1] ? `${a[0].replace(/, .*/, '')} ${d[k + 1]}` : '')).filter(Boolean).join(' · ');
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
    show(Math.max(0, Math.min(DAYS.length - 1, cur + moves[e.key])));
    live.textContent = `${long(DAYS[cur])}: ${total(DAYS[cur])} sessions`;
  });

  holder.after(fig);
  holder.hidden = true;
  draw();
  new ResizeObserver(() => {
    const shown = hover && !hover.tip.hidden;
    draw();
    if (shown) show(cur);
  }).observe(plot);
}

if (typeof document !== 'undefined') document.querySelectorAll('img[data-demo="agent-sessions"]').forEach(demo);
