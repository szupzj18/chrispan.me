// What the agent system looked like before the nightly retros, and what grew on it day by day.
// For the agents post. It replaces <img data-demo="system-growth">. That image is staticSVG(720):
// the system on Oct 25, with what was there before the first retro in gray, so the terminal (/)
// and the feed still show before and after in one picture.
//
// Each part is one capability from the retro log (Oct 15–25) that has landed in full or in part,
// placed in the box it changed; born is the day it was first written down.

export const ZONES = [
  ['me', 'Me', 'make the calls'],
  ['leader', 'Leader', 'directs, never codes'],
  ['dispatch', 'Dispatch', 'starts agents'],
  ['agents', 'Agents', 'each in its own sandbox'],
  ['context', 'Context', 'one index of every session'],
  ['retro', 'Nightly retro', 'feeds every box above'],
];
// [zone, born ('' = there before the retros), layer (1 code, 2 CI, 3 rules), label, what it does, partly landed]
export const PARTS = [
  ['me', '', 0, 'every call', 'Every decision went through me.'],
  ['me', '2026-10-15', 3, 'publish my site', 'Changes to my own site are self-checked and deployed without asking.'],
  ['me', '2026-10-16', 3, 'auto-merge my tools', 'PRs to my own tool repos merge once tests, CI and the PR check pass.'],
  ['me', '2026-10-22', 2, 'weekly decision stats', "Counts the calls I make; ones a rule already covers go to that night's retro."],
  ['me', '2026-10-25', 3, 'reversible? do, then tell', 'Local, reversible choices: the leader takes the recommended one and tells me after.'],
  ['leader', '', 0, 'leader skill', 'One agent that talks to me and to all the others.'],
  ['leader', '2026-10-15', 1, 'wait_agent.sh', 'Waits on terminal events and wakes the leader on done, blocked or timeout.'],
  ['leader', '2026-10-19', 1, 'patrol_round.py', 'One command gathers a patrol round and prints only what changed.'],
  ['leader', '2026-10-19', 3, 'only directs', 'After a decision the leader only checks facts and writes tasks; agents do the work.'],
  ['leader', '2026-10-22', 1, 'relay.sh', 'Passes my words to an agent verbatim, reads them back, waits for the reply after them.'],
  ['leader', '2026-10-25', 1, 'crons.json', 'Scheduled jobs are written down and rebuilt after an account switch or a handoff.'],
  ['dispatch', '', 0, 'spawn by hand', 'About 6 manual steps per agent.'],
  ['dispatch', '2026-10-16', 1, 'spawn_agent.sh', 'One command: tab, account, trust, start, tags, first prompt.'],
  ['dispatch', '2026-10-21', 1, 'startup check', 'Within 30 s: resend Enter if the prompt did not land, stop on a login or trust screen.'],
  ['dispatch', '2026-10-21', 1, 'hands-on rules', 'Attached to every task: literal paths for deletes, stop when blocked, check ports before a restart.'],
  ['dispatch', '2026-10-21', 1, 'coordinators', 'An agent can dispatch its own agents, with a quota and a depth limit.'],
  ['dispatch', '2026-10-25', 1, 'quota check', 'No dispatch on an account under 5% of its weekly quota; lists the accounts left.'],
  ['dispatch', '2026-10-25', 3, '--isolate', 'Data isolation, so far only as words in the prompt.', 1],
  ['agents', '', 0, 'herdr panes', 'Every agent runs in a terminal pane.'],
  ['agents', '', 0, 'zorua accounts', 'Each terminal has its own account.'],
  ['agents', '2026-10-15', 3, "decide, don't ask", 'Agents make reversible choices on their own and stop only at fixed points.'],
  ['agents', '2026-10-16', 1, 'report back', 'Agents report need, blocked, milestone or done to the leader.'],
  ['agents', '2026-10-23', 1, 'resume hint', 'A dropped connection or a sleeping machine is caught, with a hint to resume.'],
  ['agents', '2026-10-25', 1, 'takeover.sh', 'Out of quota: one command moves the session to another account.'],
  ['context', '', 0, 'mnemo', 'One index of every session on every device.'],
  ['context', '2026-10-15', 1, 'skip own session', "mnemo leaves the searcher's own session out of the results."],
  ['context', '2026-10-16', 1, 'verify_pr', 'One command checks a PR at the source: author, CI, mergeable, branch.'],
  ['context', '2026-10-16', 1, 'progress.py', 'Rewrites the progress file in one format, with the system clock.'],
  ['context', '2026-10-18', 3, 'leader handoff', 'A new leader checks every pane itself before taking over.', 1],
  ['retro', '2026-10-15', 2, 'nightly retro', 'Every night: the slips, my repeated calls, the leader’s repeated chores, and a backlog.'],
  ['retro', '2026-10-17', 2, 'skills sync', 'Every night the general parts are scrubbed and synced to my skills repo.'],
  ['retro', '2026-10-20', 3, 'replay first', "A fix lands only after replaying the day's log before and after it."],
  ['retro', '2026-10-25', 3, 'fixes go to agents', 'Adopted fixes are built by an agent; the leader only reviews them.'],
];
export const LAYER = { 0: ['before Oct 15', '#8b949e'], 1: ['code', '#79c0ff'], 2: ['CI', '#56d4dd'], 3: ['rules', '#d2a8ff'] };
// Slider stops: 0 is Oct 14, the day before the first retro; 11 is Oct 25.
const FIRST = '2026-10-14';
const STOPS = 12;
const dayOf = (i) => new Date(Date.parse(FIRST) + i * 864e5).toISOString().slice(0, 10);
const stopOf = (d) => (d ? Math.round((Date.parse(d) - Date.parse(FIRST)) / 864e5) : 0);
const md = (d) => `Oct ${+d.slice(8)}`;

const C = { surface: '#11151d', zone: '#151a23', zoneBd: '#262c36', axis: '#8b949e', text: '#d6dde6' };
const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;

// The system on Oct 25 as one SVG: zones top to bottom, parts wrapped inside, gray for what came before.
export function staticSVG(width = 720) {
  const X = 16, ZW = width - 2 * X, PADX = 14, CH = 26, GAP = 8, P = [];
  let y = 16;
  ZONES.forEach(([id, name, role], z) => {
    const parts = PARTS.filter((p) => p[0] === id);
    let cx = X + PADX, cy = y + 38;
    const chips = parts.map(([, born, layer, label, , partly]) => {
      const w = label.length * 7.2 + 20;
      if (cx + w > X + ZW - PADX) { cx = X + PADX; cy += CH + GAP; }
      const col = LAYER[layer][1];
      const g = `<rect x="${r1(cx)}" y="${cy}" width="${r1(w)}" height="${CH}" rx="5" fill="${layer ? C.surface : 'none'}" stroke="${col}" stroke-width="1.5"${partly ? ' stroke-dasharray="4 3"' : ''}/>` +
        `<text x="${r1(cx + 10)}" y="${cy + 17}" fill="${layer ? C.text : C.axis}">${esc(label)}</text>`;
      cx += w + GAP;
      return g;
    });
    const h = cy + CH + 14 - y;
    const retro = id === 'retro';
    P.push(`<rect x="${X}" y="${y}" width="${ZW}" height="${h}" rx="8" fill="${C.zone}" stroke="${retro ? '#e3b341' : C.zoneBd}" stroke-width="1.5"${retro ? ' stroke-dasharray="6 4"' : ''}/>`,
      `<text x="${X + PADX}" y="${y + 24}" fill="${C.text}" font-weight="700" font-size="13">${esc(name)}<tspan fill="${C.axis}" font-weight="400" font-size="12">  ${esc(role)}</tspan></text>`, ...chips);
    y += h;
    if (z < ZONES.length - 1) {
      const ax = X + 40, gap = retro ? 0 : z === ZONES.length - 2 ? 22 : 18;
      if (z < ZONES.length - 2) P.push(`<path d="M${ax},${y + 3}L${ax},${y + gap - 3}" stroke="${C.axis}" stroke-width="1.5"/><path d="M${ax - 4},${y + gap - 8}L${ax},${y + gap - 3}L${ax + 4},${y + gap - 8}" fill="none" stroke="${C.axis}" stroke-width="1.5"/>`);
      y += gap;
    }
  });
  y += 22;
  let lx = X;
  const key = [0, 1, 2, 3].map((k) => {
    const [t, col] = LAYER[k];
    const g = `<rect x="${r1(lx)}" y="${y - 10}" width="12" height="12" rx="3" fill="none" stroke="${col}" stroke-width="1.5"/><text x="${r1(lx + 18)}" y="${y}" fill="${C.axis}">${t}</text>`;
    lx += 18 + t.length * 7.2 + 16;
    return g;
  }).join('') + `<rect x="${r1(lx)}" y="${y - 10}" width="12" height="12" rx="3" fill="none" stroke="${C.axis}" stroke-width="1.5" stroke-dasharray="3 2"/><text x="${r1(lx + 18)}" y="${y}" fill="${C.axis}">partly</text>`;
  const H = y + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" font-family='${FONT}' font-size="12">
<rect width="${width}" height="${H}" rx="6" fill="${C.surface}"/>${P.join('')}${key}</svg>`;
}

const CSS = `
.sgr { margin: 0 0 1em; }
.sgr-bar { display: flex; flex-wrap: wrap; align-items: center; gap: .4em 1ch; margin-bottom: .6em; }
.sgr-bar button { font: inherit; font-size: .9em; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 4px; padding: .1em .9ch; cursor: pointer; }
.sgr-bar input { flex: 1 1 12em; accent-color: var(--yellow); min-width: 10em; }
.sgr-bar output { flex-basis: 100%; color: var(--dim); font-size: .9em; font-variant-numeric: tabular-nums; }
.sgr-bar output b { color: var(--fg); }
.sgr-zone { border: 1px solid var(--line); border-radius: 8px; background: var(--bg-2); padding: .5em 1.2ch .6em; }
.sgr-zone.retro { border: 1.5px dashed var(--yellow); margin-top: .8em; }
.sgr-zone + .sgr-zone:not(.retro) { margin-top: 1.1em; position: relative; }
.sgr-zone + .sgr-zone:not(.retro)::before { content: "↓"; position: absolute; top: -1.15em; left: 3ch; color: var(--dim); line-height: 1; }
.sgr-h { margin: 0 0 .4em; font-size: .95em; font-weight: 700; color: var(--fg); }
.sgr-h span { color: var(--dim); font-weight: 400; margin-left: 1ch; }
.sgr-h small { float: right; color: var(--dim); font-weight: 400; font-variant-numeric: tabular-nums; }
.sgr-parts { display: flex; flex-wrap: wrap; gap: .4em; min-height: 1.9em; }
.sgr-parts button { font: inherit; font-size: .85em; color: var(--fg); background: var(--bg); border: 1.5px solid var(--c); border-radius: 5px; padding: .1em .9ch; cursor: pointer; }
.sgr-parts button.base { color: var(--dim); background: none; }
.sgr-parts button.partly { border-style: dashed; }
.sgr-parts button.new { box-shadow: 0 0 0 2px var(--yellow); }
.sgr-parts button[aria-pressed="true"] { background: color-mix(in srgb, var(--c) 22%, var(--bg)); }
.sgr-parts > span[hidden] { display: none; }
.sgr-parts > span { animation: sgr-in .35s ease-out; }
@keyframes sgr-in { from { opacity: 0; transform: scale(.9); } }
@media (prefers-reduced-motion: reduce) { .sgr-parts > span { animation: none; } }
.sgr-detail { margin: .7em 0 .3em; min-height: 3.4em; color: var(--fg); font-size: .9em; }
.sgr-detail span { color: var(--dim); }
.sgr-key { display: flex; flex-wrap: wrap; gap: .2em 2ch; color: var(--dim); font-size: .85em; }
.sgr-key i { display: inline-block; width: .9em; height: .9em; border: 1.5px solid var(--c); border-radius: 3px; margin-right: .6ch; vertical-align: -.1em; }
`;

function demo(img) {
  if (!document.getElementById('sgr-css')) {
    const style = document.createElement('style');
    style.id = 'sgr-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const holder = img.closest('p') || img;
  const fig = document.createElement('figure');
  fig.className = 'sgr';
  fig.innerHTML = `<div class="sgr-bar"><button type="button" data-go="0">before</button><button type="button" data-play>▶ grow</button><button type="button" data-go="${STOPS - 1}">after</button>
<input type="range" min="0" max="${STOPS - 1}" step="1" aria-label="Day"><output aria-live="polite"></output></div>
<div class="sgr-zones"></div><p class="sgr-detail">Tap a box to see what it does.</p>
<div class="sgr-key">${[0, 1, 2, 3].map((k) => `<span><i style="--c:${LAYER[k][1]}"></i>${LAYER[k][0]}</span>`).join('')}<span><i style="--c:var(--dim);border-style:dashed"></i>partly landed</span><span><i style="--c:var(--yellow);box-shadow:0 0 0 2px var(--yellow);border:0"></i>new that day</span></div>`;
  const zones = fig.querySelector('.sgr-zones');
  const range = fig.querySelector('input');
  const output = fig.querySelector('output');
  const detail = fig.querySelector('.sgr-detail');
  const play = fig.querySelector('[data-play]');

  const items = [];
  const counts = {};
  for (const [id, name, role] of ZONES) {
    const sec = document.createElement('section');
    sec.className = `sgr-zone ${id}`;
    sec.innerHTML = `<div class="sgr-h">${esc(name)}<span>${esc(role)}</span><small></small></div><div class="sgr-parts"></div>`;
    counts[id] = sec.querySelector('small');
    const row = sec.querySelector('.sgr-parts');
    PARTS.filter((p) => p[0] === id).forEach((p) => {
      const [, born, layer, label, what, partly] = p;
      const li = document.createElement('span');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = (layer ? '' : 'base') + (partly ? ' partly' : '');
      b.style.setProperty('--c', LAYER[layer][1]);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        for (const it of items) it.b.setAttribute('aria-pressed', String(it.b === b));
        detail.innerHTML = `<b>${esc(label)}</b> <span>· ${born ? `${md(born)} · layer ${layer}, ${LAYER[layer][0]}` : 'there before the retros'}${partly ? ' · partly landed' : ''}</span><br>${esc(what)}`;
      });
      li.append(b);
      row.append(li);
      items.push({ li, b, zone: id, stop: stopOf(born) });
    });
    zones.append(sec);
  }

  function show(stop) {
    range.value = stop;
    let grown = 0, today = 0;
    for (const it of items) {
      const on = it.stop <= stop;
      if (it.li.hidden === on) it.li.hidden = !on;
      it.b.classList.toggle('new', on && stop > 0 && it.stop === stop);
      if (on && it.stop > 0) grown++;
      if (on && stop > 0 && it.stop === stop) today++;
    }
    for (const [id] of ZONES) {
      const n = items.filter((it) => it.zone === id && it.stop > 0 && it.stop <= stop).length;
      counts[id].textContent = n ? `+${n}` : '';
    }
    output.innerHTML = stop === 0 ? `<b>${md(dayOf(0))}</b>, the day before the first retro`
      : `<b>${md(dayOf(stop))}</b> · ${grown} parts grown${today ? `, ${today} that day` : ''}`;
  }

  let timer = null;
  function stopPlay() {
    clearInterval(timer);
    timer = null;
    play.textContent = '▶ grow';
  }
  play.addEventListener('click', () => {
    if (timer) return stopPlay();
    let s = +range.value >= STOPS - 1 ? 0 : +range.value;
    show(s);
    play.textContent = '❚❚ pause';
    timer = setInterval(() => {
      if (++s >= STOPS) return stopPlay();
      show(s);
    }, 900);
  });
  range.addEventListener('input', () => { stopPlay(); show(+range.value); });
  for (const b of fig.querySelectorAll('[data-go]')) b.addEventListener('click', () => { stopPlay(); show(+b.dataset.go); });

  holder.after(fig);
  holder.hidden = true;
  show(STOPS - 1);
}

if (typeof document !== 'undefined') document.querySelectorAll('img[data-demo="system-growth"]').forEach(demo);
