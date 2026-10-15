#!/usr/bin/env node
// Builds the site into _site/ (Node standard library only).
//
//   node scripts/build.mjs
//
// Copies the repo's static files as-is, then generates the blog from posts/*.md:
//   /blog/<slug>/index.html   one static page per post
//   /blog/index.html          post index
//   /blog/posts.json          metadata + rendered HTML, read by the terminal (/)
//   /feed.xml                 RSS 2.0
//
// A post is posts/YYYY-MM-DD-slug.md with front matter:
//   ---
//   title: "Hello, world"
//   date: 2026-10-15
//   tags: [meta]
//   summary: "One line for the index and the feed."
//   draft: false            # optional; drafts are skipped
//   ---
// Use absolute paths (/img/x.png) for images and internal links: the same HTML
// is shown at /blog/<slug>/ and inside the terminal at /.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const POSTS_DIR = path.join(ROOT, 'posts');
const SITE = 'https://chrispan.me';
const AUTHOR = { name: 'Chris Pan', url: 'https://github.com/szupzj18' };
const SKIP = new Set(['.git', '.github', '.gitignore', '.DS_Store', '_site', 'node_modules', 'posts', 'scripts']);

// ---------------------------------------------------------------- utils
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
const fail = (msg) => { console.error('build: ' + msg); process.exit(1); };

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// ---------------------------------------------------------------- front matter
function unquote(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function parseFrontMatter(src, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) fail(`${file}: missing front matter (--- ... ---)`);
  const meta = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && key) {
      if (!Array.isArray(meta[key])) meta[key] = [];
      meta[key].push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) fail(`${file}: cannot parse front matter line: ${line}`);
    key = kv[1];
    const v = kv[2].trim();
    if (v === '') meta[key] = [];
    else if (v.startsWith('[') && v.endsWith(']')) meta[key] = v.slice(1, -1).split(',').map(unquote).filter(Boolean);
    else if (v === 'true' || v === 'false') meta[key] = v === 'true';
    else meta[key] = unquote(v);
  }
  return { meta, body: src.slice(m[0].length) };
}

// ---------------------------------------------------------------- syntax highlighting
// A small tokenizer: comments, strings, numbers, keywords, literals, calls.
// Good enough for a terminal look; unknown languages are left plain.
const JS_KW = 'async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield';
const LANG_DEFS = {
  js: { kw: JS_KW, com: ['//', '/*'], str: ['"', "'", '`'] },
  ts: { kw: JS_KW + ' abstract as declare enum implements interface keyof namespace private protected public readonly satisfies type', com: ['//', '/*'], str: ['"', "'", '`'] },
  py: { kw: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case', com: ['#'], str: ['"""', "'''", '"', "'"] },
  go: { kw: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var', com: ['//', '/*'], str: ['"', "'", '`'] },
  rust: { kw: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while', com: ['//', '/*'], str: ['"'] },
  swift: { kw: 'actor any associatedtype async await break case catch class continue default defer do else enum extension fileprivate for func guard if import in init inout internal let open private protocol public repeat return self Self some static struct subscript super switch throw throws try var where while', com: ['//', '/*'], str: ['"'] },
  kotlin: { kw: 'as break class companion continue data do else enum for fun if import in interface internal is object open override package private public return sealed super suspend this throw try typealias val var when while', com: ['//', '/*'], str: ['"'] },
  sh: { kw: 'if then else elif fi for in do done while until case esac function return local export readonly set unset source', com: ['#'], str: ['"', "'"], vars: true, prompt: true },
  json: { kw: '', com: [], str: ['"'] },
};
const LANG_ALIASES = { javascript: 'js', mjs: 'js', cjs: 'js', jsx: 'js', typescript: 'ts', tsx: 'ts', python: 'py', golang: 'go', rs: 'rust', kt: 'kotlin', kts: 'kotlin', bash: 'sh', zsh: 'sh', shell: 'sh', console: 'sh', 'shell-session': 'sh' };
const LITERALS = new Set('true false null undefined None True False nil NaN'.split(' '));
const compiled = {};

function langRegex(name) {
  if (compiled[name]) return compiled[name];
  const d = LANG_DEFS[name];
  const alts = [];
  if (d.com.includes('/*')) alts.push(['com', '/\\*[\\s\\S]*?\\*/']);
  if (d.com.includes('//')) alts.push(['com', '//[^\\n]*']);
  if (d.com.includes('#')) alts.push(['com', '(?<![\\w$])#[^\\n]*']);
  for (const q of d.str) {
    if (q.length === 3) alts.push(['str', `${q}[\\s\\S]*?${q}`]);
    else if (q === '`') alts.push(['str', '`(?:\\\\[\\s\\S]|[^`\\\\])*`']);
    else alts.push(['str', `${q}(?:\\\\.|[^${q}\\\\\\n])*${q}`]);
  }
  if (d.prompt) alts.push(['prompt', '^[$%] (?=\\S)']);
  if (d.vars) alts.push(['var', '\\$(?:\\{[^}\\n]*\\}|\\w+|[@#?*!$0-9-])']);
  alts.push(['num', '\\b(?:0x[\\da-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b']);
  alts.push(['word', '[A-Za-z_]\\w*']);
  compiled[name] = { re: new RegExp(alts.map(([, src]) => `(${src})`).join('|'), 'gm'), kinds: alts.map(([k]) => k), kw: new Set(d.kw.split(' ').filter(Boolean)) };
  return compiled[name];
}

function highlight(code, lang) {
  const name = LANG_ALIASES[lang] || lang;
  if (!LANG_DEFS[name]) return esc(code);
  const { re, kinds, kw } = langRegex(name);
  let html = '';
  let last = 0;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(code))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    let kind = kinds[m.findIndex((g, i) => i > 0 && g !== undefined) - 1];
    if (kind === 'word') {
      if (kw.has(m[0])) kind = 'kw';
      else if (LITERALS.has(m[0])) kind = 'lit';
      else if (code[re.lastIndex] === '(') kind = 'fn';
      else kind = null;
    }
    html += esc(code.slice(last, m.index)) + (kind ? `<span class="tok-${kind}">${esc(m[0])}</span>` : esc(m[0]));
    last = re.lastIndex;
  }
  return html + esc(code.slice(last));
}

// ---------------------------------------------------------------- markdown
// CommonMark-ish subset: ATX headings, paragraphs, fenced code, blockquotes,
// (nested) lists, rules, images, links, autolinks, code spans, emphasis,
// strikethrough. Raw HTML is escaped, never passed through.
const LIST_RE = /^( {0,3})([-*+]|\d{1,9}[.)])( +)(.*)$/;
const FENCE_RE = /^( {0,3})(`{3,}|~{3,})\s*([\w+#.-]*)[^`]*$/;
const HR_RE = /^ {0,3}([-*_])( *\1){2,} *$/;
const HEAD_RE = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const indentOf = (l) => l.search(/\S|$/);
const startsBlock = (l) => HEAD_RE.test(l) || FENCE_RE.test(l) || HR_RE.test(l) || /^ {0,3}>/.test(l) || LIST_RE.test(l);

function safeUrl(u) {
  return !/^\s*(javascript|vbscript|data):/i.test(u.replace(/&amp;/g, '&'));
}

function inline(text) {
  const slots = [];
  const hold = (html) => '\u0000' + (slots.push(html) - 1) + '\u0000';
  text = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, t, c) => hold('<code>' + esc(c.replace(/^ (.*) $/, '$1')) + '</code>'));
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, (_, c) => hold(esc(c)));
  text = text.replace(/<(https?:\/\/[^\s<>]+)>/g, (_, u) => hold(`<a href="${esc(u)}">${esc(u)}</a>`));
  text = esc(text);
  text = text.replace(/!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g, (all, alt, src, title) =>
    safeUrl(src) ? hold(`<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`) : all);
  text = text.replace(/\[([^\]]+)\]\(\s*([^\s)]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g, (all, label, href, title) =>
    safeUrl(href) ? hold(`<a href="${href}"${title ? ` title="${title}"` : ''}>${emphasis(label)}</a>`) : label);
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)'"\u0000])/g, (_, pre, u) => pre + hold(`<a href="${u}">${u}</a>`));
  text = emphasis(text);
  text = text.replace(/(?: {2,}|\\)\n/g, '<br>\n');
  while (/\u0000\d+\u0000/.test(text)) text = text.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[n]);
  return text;
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/(^|[^\w*])\*(?=\S)([\s\S]*?\S)\*(?![\w*])/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
}

function renderBlocks(lines, ctx) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = FENCE_RE.exec(line))) {
      const [, ind, fence, lang] = m;
      const close = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
      const body = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) {
        body.push(lines[i].slice(Math.min(ind.length, indentOf(lines[i]))));
        i++;
      }
      i++;
      const l = (lang || '').toLowerCase();
      out.push(`<pre class="code"${l ? ` data-lang="${esc(l)}"` : ''}><code${l ? ` class="language-${esc(l)}"` : ''}>${highlight(body.join('\n'), l)}</code></pre>`);
      continue;
    }
    if ((m = HEAD_RE.exec(line))) {
      const level = Math.min(6, m[1].length + 1); // the page title is the only <h1>
      const html = inline(m[2] || '');
      let id = slugify(html) || 'section';
      while (ctx.ids.has(id)) id += '-';
      ctx.ids.add(id);
      out.push(`<h${level} id="${id}">${html}</h${level}>`);
      i++;
      continue;
    }
    if (HR_RE.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^ {0,3}>/.test(line)) {
      const body = [];
      while (i < lines.length && lines[i].trim() && (/^ {0,3}>/.test(lines[i]) || !startsBlock(lines[i]))) {
        body.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      out.push('<blockquote>\n' + renderBlocks(body, ctx) + '\n</blockquote>');
      continue;
    }
    if ((m = LIST_RE.exec(line))) {
      const ordered = /\d/.test(m[2]);
      const start = ordered ? parseInt(m[2], 10) : 1;
      const base = m[1].length;
      const items = [];
      let tight = true;
      let cur = null;
      let contentIndent = 0;
      while (i < lines.length) {
        const l = lines[i];
        const mm = LIST_RE.exec(l);
        if (mm && mm[1].length === base && /\d/.test(mm[2]) === ordered) {
          cur = [mm[4]];
          items.push(cur);
          contentIndent = mm[1].length + mm[2].length + Math.min(mm[3].length, 4);
          i++;
          continue;
        }
        if (!l.trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          const next = lines[j];
          const nm = next !== undefined && LIST_RE.exec(next);
          if (next !== undefined && (indentOf(next) >= contentIndent || (nm && nm[1].length === base))) {
            tight = false;
            cur.push('');
            i++;
            continue;
          }
          break;
        }
        if (indentOf(l) >= contentIndent) { cur.push(l.slice(contentIndent)); i++; continue; }
        if (!startsBlock(l) && cur[cur.length - 1].trim()) { cur.push(l.trim()); i++; continue; }
        break;
      }
      const lis = items.map((it) => {
        let html = renderBlocks(it, ctx);
        if (tight) html = html.replace(/^<p>([\s\S]*?)<\/p>/, '$1').replace(/\n<p>([\s\S]*?)<\/p>/g, '\n$1');
        return `<li>${html}</li>`;
      });
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>\n${lis.join('\n')}\n</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i]))) {
      para.push(lines[i].replace(/^ +/, ''));
      i++;
    }
    out.push('<p>' + inline(para.join('\n')) + '</p>');
  }
  return out.join('\n');
}

const renderMarkdown = (md) => renderBlocks(md.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), { ids: new Set() });

// ---------------------------------------------------------------- posts
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const posts = [];
  for (const file of fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort()) {
    const fm = /^(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/.exec(file);
    if (!fm) fail(`posts/${file}: name must be YYYY-MM-DD-slug.md (lowercase slug)`);
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'), 'posts/' + file);
    if (meta.draft === true) continue;
    if (!meta.title) fail(`posts/${file}: front matter needs a title`);
    const date = String(meta.date || fm[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail(`posts/${file}: date must be YYYY-MM-DD`);
    const slug = meta.slug || fm[2];
    const source = body.replace(/^\s*\n/, '').replace(/\s+$/, '') + '\n';
    const words = source.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
    posts.push({
      slug,
      title: meta.title,
      date,
      tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
      summary: meta.summary || '',
      file,
      url: `/blog/${slug}/`,
      minutes: Math.max(1, Math.round(words / 220)),
      html: renderMarkdown(source),
      source,
    });
  }
  const seen = new Set();
  for (const p of posts) {
    if (seen.has(p.slug)) fail(`duplicate slug: ${p.slug}`);
    seen.add(p.slug);
  }
  return posts.sort((x, y) => y.date.localeCompare(x.date) || x.slug.localeCompare(y.slug));
}

// ---------------------------------------------------------------- templates
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230b0e14'/%3E%3Ctext x='5' y='22' font-family='monospace' font-size='16' font-weight='700' fill='%237ee787'%3E%3E_%3C/text%3E%3C/svg%3E";

function layout({ title, description, canonical, type = 'website', head = '', prompt, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="chrispan.me">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#0b0e14">
  <meta name="color-scheme" content="dark">
  <link rel="alternate" type="application/rss+xml" title="Chris Pan — blog" href="/feed.xml">
  <link rel="icon" href="${FAVICON}">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.2.5/latin-400.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.2.5/latin-700.css">
  <link rel="stylesheet" href="/assets/blog.css">${head}
</head>
<body>
  <header class="top"><span class="ps1"><a class="u" href="/">chris<span class="host">@chrispan.me</span></a>:<a class="p" href="/blog/">~/blog</a>$</span> <span class="cmd">${esc(prompt)}</span></header>
${body}
</body>
</html>
`;
}

const tagList = (tags) => tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join(' ');

function postPage(p) {
  const canonical = SITE + p.url;
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    datePublished: p.date,
    description: p.summary || undefined,
    url: canonical,
    author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url },
  }).replace(/</g, '\\u003c');
  return layout({
    title: `${p.title} — Chris Pan`,
    description: p.summary || p.title,
    canonical,
    type: 'article',
    head: `\n  <meta property="article:published_time" content="${p.date}">\n  <script type="application/ld+json">${ld}</script>`,
    prompt: `cat ${p.slug}.md`,
    body: `  <main>
    <article>
      <h1>${esc(p.title)}</h1>
      <p class="meta"><time datetime="${p.date}">${p.date}</time>${p.tags.length ? ' · ' + tagList(p.tags) : ''} · ${p.minutes} min read</p>
      <div class="post">
${p.html}
      </div>
    </article>
  </main>
  <footer class="bottom">
    <span class="ps1">$</span> <a href="/blog/">cd ..</a> <span class="dim">·</span> <a href="/#read/${esc(p.slug)}">read in terminal</a> <span class="dim">·</span> <a href="/feed.xml">rss</a> <span class="dim">·</span> <a href="/">~</a>
  </footer>`,
  });
}

function indexPage(posts) {
  const rows = posts.map((p) => `      <li>
        <time datetime="${p.date}">${p.date}</time>
        <div><a class="title" href="${p.url}">${esc(p.title)}</a>${p.tags.length ? ' ' + tagList(p.tags) : ''}${p.summary ? `\n          <p>${esc(p.summary)}</p>` : ''}</div>
      </li>`).join('\n');
  return layout({
    title: 'Blog — Chris Pan',
    description: 'Posts by Chris Pan.',
    canonical: SITE + '/blog/',
    prompt: 'ls -t',
    body: `  <main>
    <h1 class="sr">Blog</h1>
    <p class="dim">total ${posts.length}</p>
    <ul class="posts">
${rows || '      <li class="dim">no posts yet</li>'}
    </ul>
  </main>
  <footer class="bottom">
    <span class="ps1">$</span> <a href="/">cd ~</a> <span class="dim">·</span> <a href="/#blog">open terminal</a> <span class="dim">·</span> <a href="/feed.xml">rss</a>
  </footer>`,
  });
}

function feed(posts) {
  const abs = (html) => html.replace(/(href|src)="\//g, `$1="${SITE}/`);
  const cdata = (s) => '<![CDATA[' + s.replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
  const rfc822 = (d) => new Date(d + 'T00:00:00Z').toUTCString();
  const items = posts.slice(0, 20).map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}${p.url}</link>
      <guid isPermaLink="true">${SITE}${p.url}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${esc(p.summary || p.title)}</description>
${p.tags.map((t) => `      <category>${esc(t)}</category>\n`).join('')}      <content:encoded>${cdata(abs(p.html))}</content:encoded>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Chris Pan — blog</title>
    <link>${SITE}/blog/</link>
    <description>Posts by Chris Pan.</description>
    <language>en</language>
${posts.length ? `    <lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>\n` : ''}    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

// ---------------------------------------------------------------- main
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true, filter: (src) => path.basename(src) !== '.DS_Store' });
}
if (fs.existsSync(path.join(OUT, 'blog')) || fs.existsSync(path.join(OUT, 'feed.xml'))) fail('blog/ and feed.xml are generated; remove them from the repo root');

const posts = loadPosts();
for (const p of posts) write(`blog/${p.slug}/index.html`, postPage(p));
write('blog/index.html', indexPage(posts));
write('blog/posts.json', JSON.stringify({ posts: posts.map(({ file, ...p }) => ({ ...p, file: 'posts/' + file })) }) + '\n');
write('feed.xml', feed(posts));
console.log(`build: ${posts.length} post(s) → ${path.relative(process.cwd(), OUT) || '.'}/ (${posts.map((p) => p.slug).join(', ') || 'none'})`);
