'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const man = $('man');

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : String(c));
    }
    return el;
  }
  const b = (...k) => h('b', null, ...k);
  const u = (...k) => h('u', null, ...k);
  const pretty = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const a = (url, text) => h('a', { href: url, class: text ? null : 'bare' }, text || pretty(url));
  const shortRepo = (D, full) => (full.startsWith(D.profile.login + '/') ? full.slice(D.profile.login.length + 1) : full);

  function section(id, title, ...body) {
    return h('section', { id, 'aria-labelledby': 'h-' + id }, h('h2', { id: 'h-' + id }, h('a', { href: '#' + id }, title)), ...body);
  }
  const p = (...k) => h('p', { class: 'ind' }, ...k);

  function render(D, posts) {
    const P = D.profile;
    const own = D.repos;
    const highlighted = new Set([...D.building, ...D.featured].map((x) => x.name));
    const out = [];

    out.push(section('name', 'NAME',
      p(b('chrispan'), ' — ', P.tagline.replace(/\.$/, '').replace(/^Software Engineer/, 'software engineer'))));

    out.push(section('synopsis', 'SYNOPSIS',
      h('p', { class: 'syn' }, b('chrispan'), ' [', b('--session-memory'), '] [', b('--multi-account'), '] [', b('--simulator-control'), '] ', u('coding-agent'), '…'),
      h('p', { class: 'syn' }, b('chrispan'), ' ', b('--learn'), ' ', u('how-things-work')),
      h('p', { class: 'syn' }, b('chrispan'), ' ', b('--say-hi'))));

    out.push(section('description', 'DESCRIPTION',
      P.intro ? p(b(P.intro)) : null,
      p(b(P.name), ' (', a(P.html_url, '@' + P.login), ') is currently ', P.now.charAt(0).toLowerCase() + P.now.slice(1)),
      p('The public record: ', b(String(own.length)), ' repositories on GitHub, ',
        b(String(D.contributions.total_last_year)), ' contributions in the last year, ', P.followers, ' followers.')));

    const optFlags = { Languages: ['-l', '--languages'], Mobile: ['-m', '--mobile'], 'AI / Agents': ['-a', '--agents'], 'Dev Tools': ['-t', '--tools'] };
    out.push(section('options', 'OPTIONS',
      h('dl', null, D.skills.map((k) => {
        const f = optFlags[k.area] || ['', '--' + k.area.toLowerCase().replace(/[^a-z]+/g, '-')];
        return [h('dt', null, f[0] ? [b(f[0]), ', '] : '', b(f[1])), h('dd', null, k.items.join(', ') + '.')];
      }))));

    const projDl = (list) => h('dl', null, list.map((x) => {
      const r = D.repos.find((y) => y.name === x.name);
      const links = [a(r ? r.url : x.url)];
      if (x.homepage || (r && r.homepage)) links.push(' · ', a(x.homepage || r.homepage));
      else if (x.url && r && x.url !== r.url) links.push(' · ', a(x.url));
      return [
        h('dt', null, b(x.name), '(1)', r ? h('span', { class: 'meta' }, '  ' + (r.language || '') + (r.stars ? ' · ★' + r.stars : '')) : ''),
        h('dd', null, h('p', null, x.summary), h('p', null, h('span', { class: 'dim' }, 'Stack: '), x.stack.join(', '), '. ', links)),
      ];
    }));
    out.push(section('building', 'CURRENTLY BUILDING', projDl(D.building)));
    out.push(section('featured', 'FEATURED', projDl(D.featured)));

    // same list as the terminal's `blog` and /blog/ (built from posts/*.md)
    const abs = (path) => new URL(path, location.href).href;
    out.push(section('posts', 'POSTS', posts.error
      ? p(h('span', { class: 'dim' }, 'Could not load the post list (' + posts.error + '). See '), a(abs('/blog/')), '.')
      : [h('ol', { class: 'hist posts' }, posts.list.map((x) => h('li', null, h('time', { datetime: x.date }, x.date),
          h('span', null, h('a', { href: abs(x.url) }, b(x.title)), x.summary ? h('span', { class: 'dim sum' }, ' — ' + x.summary) : '')))),
        p(h('span', { class: 'dim' }, 'All posts: '), a(abs('/blog/')), h('span', { class: 'dim' }, ' · RSS: '), a(abs('/feed.xml')))]));

    out.push(section('repositories', 'REPOSITORIES',
      p('Public repositories, most recently pushed first. ', h('span', { class: 'tag' }, '*'), ' marks the projects above.'),
      h('dl', null, own.filter((r) => r.name !== 'chrispan.me').map((r) => [
        h('dt', null, h('a', { href: r.url, class: 'bare' }, b(r.name)), highlighted.has(r.name) ? h('span', { class: 'tag' }, ' *') : '',
          h('span', { class: 'meta' }, '  ' + [r.language, r.stars ? '★' + r.stars : null, r.pushed_at.slice(0, 10)].filter(Boolean).join(' · '))),
        r.description ? h('dd', null, r.description) : null,
      ]))));

    const verb = (e) => {
      const repo = shortRepo(D, e.repo);
      switch (e.kind) {
        case 'pr': return [b(repo), ' ', a(e.url, '#' + e.number), ' ', e.action, ': ', e.title];
        case 'push': return [b(repo), ' pushed ', e.count + '× to ', u(e.branch)];
        case 'release': return [b(repo), ' released ', a(e.url, e.tag)];
        default: return [e.kind, ' ', repo];
      }
    };
    out.push(section('history', 'HISTORY',
      h('ol', { class: 'hist' }, D.activity.slice(0, 14).map((e) => h('li', null, h('time', { datetime: e.at }, e.at.slice(0, 10)), h('span', null, verb(e))))),
      p(h('span', { class: 'dim' }, 'From public GitHub events. Full log: '), a(P.html_url))));

    out.push(section('exit-status', 'EXIT STATUS',
      p(b('0'), '   always. Still learning — ', D.learning)));

    out.push(section('bugs', 'BUGS',
      p(D.hello, ' Report at ', a(P.html_url), '.')));

    out.push(section('see-also', 'SEE ALSO',
      p([...D.building, ...D.featured].map((x, i) => {
        const r = D.repos.find((y) => y.name === x.name);
        return [i ? ', ' : '', h('a', { href: (r && r.homepage) || x.homepage || x.url, class: 'bare' }, b(x.name), '(1)')];
      }), ', ', h('a', { href: '/blog/', class: 'bare' }, b('blog'), '(7)'), ', ', h('a', { href: P.html_url, class: 'bare' }, b('github'), '(7)'), '.')));

    out.push(section('author', 'AUTHOR',
      p(P.name, ' <', a(P.html_url), '>.'),
      p(h('span', { class: 'dim' }, 'Rendered from public GitHub data, ' + D.generated_at.slice(0, 10) + '.'))));

    man.replaceChildren(...out);
    $('gen').textContent = D.generated_at.slice(0, 10);
    $('toc').replaceChildren(...[...man.querySelectorAll('section')].map((sct) => h('a', { href: '#' + sct.id }, sct.querySelector('h2').textContent)));
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    document.documentElement.dataset.ready = '1'; // scripts/pdf.mjs waits for this
  }

  // ---------- print: show collapsed sections ----------
  let closedForPrint = [];
  addEventListener('beforeprint', () => {
    closedForPrint = [...document.querySelectorAll('details:not([open])')];
    closedForPrint.forEach((d) => { d.open = true; });
  });
  addEventListener('afterprint', () => { closedForPrint.forEach((d) => { d.open = false; }); });

  // ---------- less(1) keys ----------
  const less = $('less');
  const msg = $('less-msg');
  const sform = $('less-search');
  const sq = $('less-q');
  const lh = () => parseFloat(getComputedStyle(document.body).lineHeight) || 24;
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const defaultMsg = msg.innerHTML;

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      const lineEl = $('less-line'); // re-queried: the status message is rebuilt on reset
      if (lineEl) lineEl.textContent = atEnd ? Math.round(scrollY / lh()) + 1 + '/' + Math.round(document.documentElement.scrollHeight / lh()) + ' (END)' : String(Math.round(scrollY / lh()) + 1);
    });
  }, { passive: true });

  function say(nodes) { msg.replaceChildren(...[].concat(nodes)); }
  function resetMsg() { msg.innerHTML = defaultMsg; }

  let matches = [];
  let mi = -1;
  function clearMarks() {
    for (const m of man.querySelectorAll('mark')) m.replaceWith(m.textContent);
    man.normalize();
    matches = [];
    mi = -1;
  }
  function search(q) {
    clearMarks();
    if (!q) return;
    const ql = q.toLowerCase();
    const walker = document.createTreeWalker(man, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const text = n.nodeValue;
      const lower = text.toLowerCase();
      let i = lower.indexOf(ql);
      if (i < 0) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      while (i >= 0) {
        frag.append(text.slice(last, i));
        const m = h('mark', null, text.slice(i, i + q.length));
        frag.append(m);
        matches.push(m);
        last = i + q.length;
        i = lower.indexOf(ql, last);
      }
      frag.append(text.slice(last));
      n.replaceWith(frag);
    }
    if (!matches.length) { say(['Pattern not found  (press ', h('kbd', null, 'RETURN'), ')']); return; }
    // first match below the top of the viewport, like less
    mi = matches.findIndex((m) => m.getBoundingClientRect().top > 4);
    if (mi < 0) mi = 0;
    jump(0);
  }
  function jump(dir) {
    if (!matches.length) return;
    mi = (mi + dir + matches.length) % matches.length;
    const m = matches[mi];
    const det = m.closest('details');
    if (det) det.open = true;
    m.scrollIntoView({ block: 'center', behavior: smooth() });
    say(['/' + sq.value + '  ', h('span', null, 'match ' + (mi + 1) + ' of ' + matches.length + ' — '), h('kbd', null, 'n'), '/', h('kbd', null, 'N'), ' next/prev']);
  }

  sform.addEventListener('submit', (e) => {
    e.preventDefault();
    sform.hidden = true;
    msg.hidden = false;
    search(sq.value.trim());
  });
  sq.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); sform.hidden = true; msg.hidden = false; resetMsg(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches && e.target.matches('input, textarea, select')) return;
    const H = lh();
    const page = innerHeight - 3 * H;
    const go = (y) => { e.preventDefault(); scrollBy({ top: y, behavior: y > H * 1.5 || y < -H * 1.5 ? smooth() : 'auto' }); };
    switch (e.key) {
      case 'j': case 'e': go(H); break;
      case 'k': case 'y': go(-H); break;
      case 'd': go(page / 2); break;
      case 'u': go(-page / 2); break;
      case ' ':
        if (e.target.closest && e.target.closest('a, button, summary')) return;
        go(e.shiftKey ? -page : page); break;
      case 'f': go(page); break;
      case 'b': go(-page); break;
      case 'g': e.preventDefault(); scrollTo({ top: 0, behavior: smooth() }); break;
      case 'G': e.preventDefault(); scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth() }); break;
      case '/':
        e.preventDefault();
        msg.hidden = true;
        sform.hidden = false;
        sq.value = '';
        sq.focus();
        break;
      case 'n': if (matches.length) { e.preventDefault(); jump(1); } break;
      case 'N': if (matches.length) { e.preventDefault(); jump(-1); } break;
      case 'h':
        e.preventDefault();
        say([h('kbd', null, 'j'), '/', h('kbd', null, 'k'), ' line  ', h('kbd', null, 'space'), '/', h('kbd', null, 'b'), ' page  ', h('kbd', null, 'g'), '/', h('kbd', null, 'G'), ' top/end  ', h('kbd', null, '/'), ' search  ', h('kbd', null, 'n'), ' next  ', h('kbd', null, 'q'), ' quit']);
        break;
      case 'q':
        e.preventDefault();
        say(['there is no shell to return to — try ', h('a', { href: 'https://github.com/szupzj18', style: 'color:inherit' }, 'github.com/szupzj18')]);
        break;
      case 'Enter': case 'Escape':
        if (e.target.closest && e.target.closest('a, button, summary')) return;
        clearMarks(); resetMsg();
        break;
      default:
    }
  });

  // Same sources as the homepage terminal: /data.json and the blog build's /blog/posts.json.
  const json = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  Promise.all([json('/data.json'), json('/blog/posts.json').then((x) => ({ list: x.posts }), (err) => ({ list: [], error: err.message }))])
    .then(([d, posts]) => {
      render(d, posts);
      less.hidden = false;
    })
    .catch((err) => {
      man.append(section('error', 'ERRORS', p('Could not load data.json (' + err.message + '). See ', a('https://github.com/szupzj18'), '.')));
    });
})();
