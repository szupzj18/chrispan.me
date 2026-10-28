// Builds the /reading/ card gallery from the "reading-list" post (Node standard library only).
//
// Each "## <number> <title>" section of the post becomes one card; the section body is shown in a
// dialog. A cover is optional: img/reading/<number>.jpg. Without it the card shows the title on a
// coloured tile. build.mjs calls readingPage() and writes the result to /reading/index.html.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  let out = '';
  let pos = 0;
  const pat = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<）)]+)/g;
  for (const m of s.matchAll(pat)) {
    out += esc(s.slice(pos, m.index));
    const href = m[2] || m[3];
    out += `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(m[1] ? m[1].trim() : href)}</a>`;
    pos = m.index + m[0].length;
  }
  out += esc(s.slice(pos));
  return out
    .replace(/\*\*(\S.*?\S|\S)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(\S.*?\S|\S)~~/g, '<del>$1</del>')
    .replace(/(^|[^\w*])\*(\S.*?\S|\S)\*(?![\w*])/g, '$1<em>$2</em>');
}

function render(body) {
  return body.trim().split(/\n\s*\n/).filter((b) => b.trim()).map((b) => {
    const ls = b.split('\n');
    if (ls.every((l) => l.startsWith('>'))) {
      const rows = ls.map((l) => l.replace(/^>\s?/, '')).filter((l) => l.trim());
      return '<blockquote>' + rows.map(inline).join('<br>') + '</blockquote>';
    }
    if (ls.every((l) => l.startsWith('- '))) return '<ul>' + ls.map((l) => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>';
    return '<p>' + ls.map(inline).join('<br>') + '</p>';
  }).join('\n');
}

function parseTitle(head) {
  return head
    .replace(/^\s*(~~)?\s*\[?\s*\d+\s*/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\]\([^)]*\)/g, '')
    .replace(/[\[\]✅👍🏻*~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCards(source, root) {
  return source.split(/^## /m).slice(1).map((section) => {
    const nl = section.indexOf('\n');
    const head = nl < 0 ? section : section.slice(0, nl);
    const body = nl < 0 ? '' : section.slice(nl + 1);
    const num = Number(/\d+/.exec(head)[0]);
    const full = head + '\n' + body;
    const pct = [...full.replace(/https?:\/\/\S+/g, '').matchAll(/(?<![\w%])(\d{1,3})%/g)].map((m) => Number(m[1]));
    const state = [];
    if (full.includes('弃坑')) state.push(['drop', '弃坑']);
    else if (full.includes('✅') || full.includes('看完了') || (pct.length && Math.max(...pct) === 100)) state.push(['done', '读完']);
    else if (pct.length) state.push(['part', Math.min(...pct) + '%']);
    if (full.includes('👍')) state.push(['like', '👍']);
    return {
      num,
      title: parseTitle(head) || `#${num}`,
      state,
      cover: fs.existsSync(path.join(root, 'img/reading', `${num}.jpg`)),
      body: render(body),
    };
  });
}

const hue = (s) => parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, 4), 16) % 360;

const CSS = `
    body { max-width: 1080px; }
    .grid { list-style: none; margin: 1.4em 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 18px 14px; }
    .card button { all: unset; box-sizing: border-box; display: block; width: 100%; cursor: pointer; }
    .card button:focus-visible { outline: 2px solid var(--yellow); outline-offset: 3px; }
    .art { display: block; aspect-ratio: 2 / 3; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; background: var(--bg-2); transition: transform .15s, border-color .15s; }
    .card button:hover .art { transform: translateY(-3px); border-color: var(--dim); }
    .art img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .ph { display: flex; align-items: center; justify-content: center; height: 100%; padding: 12px; text-align: center; font-weight: 700; line-height: 1.4; overflow: hidden; background: hsl(var(--h) 35% 17%); color: hsl(var(--h) 70% 80%); }
    .cap { display: block; margin-top: .5em; font-size: 13px; line-height: 1.4; }
    .cap .n { color: var(--dim); }
    .cap .t { color: var(--fg); overflow-wrap: anywhere; }
    .bs { display: flex; gap: 6px; margin-top: .3em; flex-wrap: wrap; }
    .b { font-size: 11px; line-height: 1.5; padding: 0 6px; border: 1px solid var(--line); border-radius: 3px; color: var(--dim); }
    .b.done { color: var(--green); border-color: color-mix(in srgb, var(--green) 40%, transparent); }
    .b.drop { color: var(--dim); text-decoration: line-through; }
    .b.part { color: var(--yellow); border-color: color-mix(in srgb, var(--yellow) 40%, transparent); }
    dialog { width: min(640px, calc(100vw - 32px)); max-height: calc(100vh - 48px); padding: 20px 24px; background: var(--bg-2); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; font: inherit; }
    dialog::backdrop { background: rgb(0 0 0 / .6); }
    .dcov { float: right; width: 120px; margin: 0 0 12px 16px; border-radius: 3px; border: 1px solid var(--line); }
    dialog h2 { margin: 0; font-size: 1.15em; color: var(--yellow); overflow-wrap: anywhere; }
    dialog .meta { margin: .3em 0 1em; color: var(--dim); font-size: 13px; }
    dialog p, dialog ul, dialog blockquote { margin: 0 0 1em; overflow-wrap: anywhere; }
    dialog blockquote { padding-left: 1ch; border-left: 2px solid var(--line); color: var(--dim); }
    dialog form { margin: 0; text-align: right; }
    dialog form button { font: inherit; color: var(--cyan); background: none; border: 0; cursor: pointer; padding: 0; }`;

const SCRIPT = `
    const d = document.getElementById('d'), dc = document.getElementById('dc');
    document.querySelectorAll('.card').forEach((li) => {
      li.querySelector('button').addEventListener('click', () => {
        dc.replaceChildren(li.querySelector('template').content.cloneNode(true));
        d.showModal();
      });
    });
    const hn = location.hash.slice(1);
    if (hn) document.querySelector('.card[data-n="' + CSS.escape(hn) + '"] button')?.click();
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });`;

export function readingPage(source, { root, favicon, textUrl }) {
  const cards = parseCards(source, root);
  const items = cards.map((c) => {
    const badges = c.state.map(([k, v]) => `<span class="b ${k}">${esc(v)}</span>`).join('');
    const art = c.cover
      ? `<img src="/img/reading/${c.num}.jpg" alt="" loading="lazy">`
      : `<span class="ph" style="--h:${hue(c.title)}">${esc(c.title)}</span>`;
    const dcov = c.cover ? `<img class="dcov" src="/img/reading/${c.num}.jpg" alt="">` : '';
    const notes = c.body || '<p class="dim">no notes yet</p>';
    return `    <li class="card" data-n="${c.num}">
      <button type="button" aria-label="${esc(c.title)}"><span class="art">${art}</span><span class="cap"><span class="n">#${c.num}</span> <span class="t">${esc(c.title)}</span></span>${badges ? `<span class="bs">${badges}</span>` : ''}</button>
      <template>${dcov}<h2>${esc(c.title)}</h2><p class="meta">#${c.num}${badges ? ' · ' + badges : ''}</p>${notes}</template>
    </li>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Reading gallery — Chris Pan</title>
  <meta name="description" content="A gallery of ${cards.length} books, essays and talks I have read, with notes.">
  <link rel="canonical" href="https://chrispan.me/reading/">
  <meta name="theme-color" content="#0b0e14">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="${favicon}">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.2.5/latin-400.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.2.5/latin-700.css">
  <link rel="stylesheet" href="/assets/blog.css">
  <style>${CSS}
  </style>
</head>
<body>
  <header class="top"><span class="ps1"><a class="u" href="/">chris<span class="host">@chrispan.me</span></a>:<a class="p" href="/reading/">~/reading</a>$</span> <span class="cmd">ls -t</span></header>
  <main>
    <h1 class="sr">Reading gallery</h1>
    <p class="dim">total ${cards.length} · click a card for notes · <a href="${textUrl}">same list as text</a></p>
    <ul class="grid">
${items}
    </ul>
  </main>
  <dialog id="d"><div id="dc"></div><form method="dialog"><button autofocus>close</button></form></dialog>
  <footer class="bottom">
    <span class="ps1">$</span> <a href="/blog/">cd blog</a> <span class="dim">·</span> <a href="/">~</a>
  </footer>
  <script>${SCRIPT}
  </script>
</body>
</html>
`;
}
