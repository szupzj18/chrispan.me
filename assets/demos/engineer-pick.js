// What engineers do, why software is worth it, where the money comes from: the reader picks
// which of these still need a person. For the agents post.
// It replaces <img data-demo="engineer-pick">. That image is pickSVG(720) with nothing picked,
// so the terminal (/) and the feed show the same three groups with no answer drawn in.
//
// After a 3Blue1Brown slide on what mathematicians do. Icons are Lucide (ISC license,
// https://lucide.dev/license), inlined so the page loads nothing else.

const ICONS = {
  "code-xml": [["path",{"d":"m18 16 4-4-4-4"}],["path",{"d":"m6 8-4 4 4 4"}],["path",{"d":"m14.5 4-5 16"}]],
  "message-circle-question-mark": [["path",{"d":"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],
  "blocks": [["path",{"d":"M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"}],["rect",{"x":"14","y":"2","width":"8","height":"8","rx":"1"}]],
  "package-check": [["path",{"d":"M12 22V12"}],["path",{"d":"m16 17 2 2 4-4"}],["path",{"d":"M21 11.127V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.32-.753"}],["path",{"d":"M3.29 7 12 12l8.71-5"}],["path",{"d":"m7.5 4.27 8.997 5.148"}]],
  "rocket": [["path",{"d":"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"}],["path",{"d":"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"}],["path",{"d":"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"}],["path",{"d":"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"}]],
  "compass": [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"}]],
  "gem": [["path",{"d":"M10.5 3 8 9l4 13 4-13-2.5-6"}],["path",{"d":"M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"}],["path",{"d":"M2 9h20"}]],
  "building": [["path",{"d":"M12 10h.01"}],["path",{"d":"M12 14h.01"}],["path",{"d":"M12 6h.01"}],["path",{"d":"M16 10h.01"}],["path",{"d":"M16 14h.01"}],["path",{"d":"M16 6h.01"}],["path",{"d":"M8 10h.01"}],["path",{"d":"M8 14h.01"}],["path",{"d":"M8 6h.01"}],["path",{"d":"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"}],["rect",{"x":"4","y":"2","width":"16","height":"20","rx":"2"}]],
  "credit-card": [["rect",{"width":"20","height":"14","x":"2","y":"5","rx":"2"}],["line",{"x1":"2","x2":"22","y1":"10","y2":"10"}],["path",{"d":"M6 14h2"}]],
  "heart-handshake": [["path",{"d":"M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"}]],
  "presentation": [["path",{"d":"M2 3h20"}],["path",{"d":"M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"}],["path",{"d":"m7 21 5-5 5 5"}]],
};

export const GROUPS = [
  { title: 'What engineers do', items: [['code-xml', 'Write', 'code'], ['message-circle-question-mark', 'Find', 'the need'], ['blocks', 'Design', 'systems'], ['package-check', 'Ship', 'products']] },
  { title: 'Why software is worth it', items: [['rocket', 'Features', 'now & later'], ['compass', 'Judgment', 'what to build'], ['gem', 'Taste', "what's good"]] },
  { title: 'Where the money comes from', items: [['building', 'Employers', '(salary)'], ['credit-card', 'Customers'], ['heart-handshake', 'Sponsors'], ['presentation', 'Consulting', '& teaching']] },
];
const ALL = GROUPS.flatMap((g) => g.items);

const C = { bg: '#0b0e14', card: '#111a2a', cardBd: '#22395c', blue: '#6aa6f5', on: '#f5e23c', rule: '#2a3140', head: '#8c8c8c', text: '#e6e6e6' };
const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const W = 720, X = 40, CW = 640, T = 104;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const icon = (name, cx, cy, size, color) => `<g transform="translate(${cx - size / 2},${cy - size / 2}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
  ICONS[name].map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('') + '</g>';
const text = (x, y, s, { size = 25, weight = 400, fill = C.text, anchor = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

// picked: a Set of item indexes (0–10) drawn lit. Tiles carry data-i so the demo can make them buttons.
export function pickSVG(picked = new Set()) {
  const P = [];
  let y = 24, n = 0;
  for (const g of GROUPS) {
    P.push(text(X, y + 40, g.title, { size: 32, fill: C.head, anchor: 'start' }),
      `<line x1="${X}" y1="${y + 62}" x2="${X + CW}" y2="${y + 62}" stroke="${C.rule}" stroke-width="2"/>`);
    const slot = CW / g.items.length, cy = y + 62 + 34 + T / 2;
    g.items.forEach(([name, label, sub], k) => {
      const i = n++, on = picked.has(i), cx = X + slot * (k + 0.5);
      P.push(`<g class="egp-tile" data-i="${i}">` +
        `<rect x="${cx - slot / 2 + 4}" y="${cy - T / 2 - 8}" width="${slot - 8}" height="${T + 96}" fill="transparent"/>` +
        `<rect class="egp-box" x="${cx - T / 2}" y="${cy - T / 2}" width="${T}" height="${T}" rx="24" fill="${C.card}" stroke="${on ? C.on : C.cardBd}" stroke-width="${on ? 3 : 2}"/>` +
        icon(name, cx, cy, 54, on ? C.on : C.blue) +
        text(cx, cy + T / 2 + 38, label, { weight: on ? 700 : 400, fill: on ? '#fff' : C.text }) +
        (sub ? text(cx, cy + T / 2 + 70, sub, { size: 22, weight: on ? 700 : 400, fill: on ? '#fff' : C.text }) : '') + '</g>');
    });
    y = cy + T / 2 + 120;
  }
  const H = y - 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}'>
<rect width="${W}" height="${H}" rx="6" fill="${C.bg}"/>${P.join('')}</svg>`;
}

const CSS = `
.egp { margin: 0 0 1em; }
.egp-ask { margin: 0 0 .5em; color: var(--fg); }
.egp svg { display: block; width: 100%; height: auto; }
.egp-tile { cursor: pointer; outline: none; }
.egp-tile:focus-visible .egp-box { stroke: var(--yellow); stroke-dasharray: 6 5; }
.egp-tile:hover .egp-box { stroke: #4a6a9a; }
.egp-foot { display: flex; gap: 1ch; align-items: baseline; margin-top: .4em; color: var(--dim); font-size: .9em; }
.egp-foot b { color: var(--fg); font-variant-numeric: tabular-nums; }
.egp-foot button { font: inherit; color: var(--dim); background: none; border: 1px solid var(--line); border-radius: 4px; padding: 0 .8ch; cursor: pointer; }
.egp-foot button[hidden] { display: none; }
`;

function demo(img) {
  if (!document.getElementById('egp-css')) {
    const style = document.createElement('style');
    style.id = 'egp-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const holder = img.closest('p') || img;
  const fig = document.createElement('figure');
  fig.className = 'egp';
  fig.innerHTML = `<p class="egp-ask">Which of these still need a person? Tap the ones you would keep.</p><div class="egp-plot"></div>
<div class="egp-foot"><span aria-live="polite"></span><button type="button" hidden>clear</button></div>`;
  const plot = fig.querySelector('.egp-plot');
  const count = fig.querySelector('[aria-live]');
  const clear = fig.querySelector('button');
  const picked = new Set();

  function draw(focus) {
    plot.innerHTML = pickSVG(picked);
    const svg = plot.querySelector('svg');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', img.alt);
    for (const g of plot.querySelectorAll('.egp-tile')) {
      const i = +g.dataset.i;
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-pressed', String(picked.has(i)));
      g.setAttribute('aria-label', ALL[i].slice(1).join(' '));
      g.addEventListener('click', () => toggle(i));
      g.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggle(i);
      });
    }
    if (focus != null) plot.querySelector(`[data-i="${focus}"]`).focus();
    const n = picked.size;
    count.innerHTML = n ? `You kept <b>${n}</b> of ${ALL.length}: ${[...picked].sort((a, b) => a - b).map((i) => esc(ALL[i].slice(1).join(' '))).join(', ')}.` : `Nothing kept yet.`;
    clear.hidden = !n;
  }
  function toggle(i) {
    if (picked.has(i)) picked.delete(i);
    else picked.add(i);
    draw(i);
  }
  clear.addEventListener('click', () => {
    picked.clear();
    draw();
  });

  holder.after(fig);
  holder.hidden = true;
  draw();
}

if (typeof document !== 'undefined') document.querySelectorAll('img[data-demo="engineer-pick"]').forEach(demo);
