'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const narrowMQ = matchMedia('(max-width: 759px)');
  const DAY = 86400000;
  const NOW = Date.now();
  const SORTS = ['pushed', 'name', 'stars', 'lang'];
  const state = { sort: 'pushed', q: '', sel: 0, open: null, list: [], workLang: 'en' };
  let D = null;

  // ---------- helpers ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : String(c));
    }
    return el;
  }
  const s = (cls, ...k) => h('span', { class: cls }, ...k);
  function svg(tag, attrs, ...kids) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    for (const c of kids.flat()) if (c != null) el.append(c);
    return el;
  }
  const pretty = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const a = (url, text, cls) => h('a', { href: url, target: '_blank', rel: 'noopener', class: cls }, text || pretty(url));
  const langCls = (l) => 'lang-' + (l ? l.toLowerCase().replace(/[^a-z]+/g, '') : 'none');
  const days = (iso) => (NOW - Date.parse(iso)) / DAY;
  const stOf = (r) => (days(r.pushed_at) <= 30 ? 'R' : days(r.pushed_at) <= 365 ? 'S' : 'I');
  const shortRepo = (full) => (full.startsWith(D.profile.login + '/') ? full.slice(D.profile.login.length + 1) : full);
  function ago(iso) {
    const d = days(iso);
    if (d < 1) return 'today';
    if (d < 60) return Math.floor(d) + 'd ago';
    if (d < 730) return Math.floor(d / 30.44) + 'mo ago';
    return Math.floor(d / 365.25) + 'y ago';
  }
  function agoShort(iso) {
    const d = days(iso);
    if (d < 1) return 'today';
    if (d < 60) return Math.floor(d) + 'd';
    if (d < 730) return Math.floor(d / 30.44) + 'mo';
    return Math.floor(d / 365.25) + 'y';
  }
  const featOf = (name) => [...D.building, ...D.featured].find((f) => f.name === name);
  const tagOf = (name) => (D.building.some((b) => b.name === name) ? 'now' : D.featured.some((f) => f.name === name) ? 'feat' : '');

  // ---------- header ----------
  function renderHead() {
    const running = D.repos.filter((r) => stOf(r) === 'R').length;
    $('tasks').replaceChildren('Tasks: ', h('b', null, D.repos.length), ' repos; ', h('b', null, running), ' running');
    const cd = D.contributions.days;
    const sum = (n) => cd.slice(-n).reduce((t, d) => t + d.count, 0);
    const created = new Date(D.profile.created_at);
    const now = new Date(NOW);
    const months = (now.getFullYear() - created.getFullYear()) * 12 + now.getMonth() - created.getMonth() - (now.getDate() < created.getDate() ? 1 : 0);
    const load = $('load');
    load.title = 'contributions: today · last 7 days · last 30 days';
    load.replaceChildren('Uptime: ', h('b', null, Math.floor(months / 12) + 'y ' + (months % 12) + 'm'), '  Load average: ', h('b', null, sum(1) + ' ' + sum(7) + ' ' + sum(30)));
  }

  // ---------- whoami ----------
  function renderProf() {
    const p = D.profile;
    const sep = () => s('dim', ' · ');
    $('prof').replaceChildren(
      h('div', { class: 'who' },
        h('img', { class: 'avatar', src: p.avatar_url + (p.avatar_url.includes('?') ? '&' : '?') + 's=40', alt: '', width: 72, height: 72, loading: 'lazy', decoding: 'async' }),
        h('div', null,
          h('h3', null, p.name, s('dim', ' @' + p.login)),
          h('p', null, p.tagline),
          p.intro ? h('p', { class: 'intro' }, p.intro) : null,
          h('p', { class: 'dim' }, D.hello))),
      h('dl', { class: 'kv' },
        h('dt', null, 'now'), h('dd', null, p.now),
        h('dt', null, 'learn'), h('dd', null, D.learning),
        h('dt', null, 'links'), h('dd', null, D.links.map((l, i) => [i ? sep() : '', a(l.url, l.label.toLowerCase())])),
        h('dt', null, 'social'), h('dd', null, p.followers + ' followers', sep(), p.following + ' following')));
  }

  function renderWork() {
    const zh = state.workLang === 'zh';
    $('work').lang = zh ? 'zh-CN' : 'en';
    $('work-label').lang = $('work').lang;
    $('work-label').textContent = zh ? '精选工作' : 'selected work';
    $('work').replaceChildren(...(D.selected_work || []).map((item) => {
      const work = zh ? item.zh : item;
      return h('article', null, h('h3', null, work.title), h('p', null, work.summary));
    }));
    document.querySelectorAll('[data-work-lang]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.workLang === state.workLang)));
  }

  $('p-work').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-work-lang]');
    if (!button || !D) return;
    state.workLang = button.dataset.workLang;
    renderWork();
  });

  // ---------- langs + env ----------
  function renderLang() {
    const langs = D.languages.slice(0, 6);
    const max = Math.max(...langs.map((l) => l.repos));
    const ticks = '|'.repeat(160);
    const meters = langs.map((l) => h('div', { class: 'meter', title: l.repos + ' own repos in ' + l.name },
      s('lbl ' + langCls(l.name), l.name),
      h('span', { class: 'trk' }, s('br', '['), h('span', { class: 'fill ' + langCls(l.name), style: '--p:' + (l.repos / max) * 100 + '%' }, ticks), s('val', String(l.repos)), s('br', ']'))));
    const env = h('div', { class: 'env' }, h('div', { class: 'prompt' }, '$ env | grep CHRIS_'),
      D.skills.map((k) => {
        const key = 'CHRIS_' + k.area.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/_+$/, '');
        const q = k.items.some((x) => /\s/.test(x)) ? '"' : '';
        // <wbr> after each ':' so long values wrap at separators, not mid-word
        const val = k.items.flatMap((x, i) => (i ? [':', h('wbr'), x] : [x]));
        return h('div', null, s('var', key), '=', q, val, q);
      }));
    $('lang').replaceChildren(...meters, env);
  }

  // ---------- contribution graph ----------
  function renderGraph() {
    const cd = D.contributions.days;
    const weeks = [];
    for (let i = 0; i < cd.length; i += 7) weeks.push(cd.slice(i, i + 7));
    const sums = weeks.map((w) => w.reduce((t, d) => t + d.count, 0));
    const max = Math.max(1, ...sums);
    const bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Weekly contributions over the last year, peak ' + max + ' in a week' });
    const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en', { month: 'short', year: '2-digit' }).replace(' ', " '");
    const mid = weeks[Math.floor(weeks.length / 2)][0].date;
    const axis = h('div', { class: 'axis', 'aria-hidden': 'true' }, s('', fmt(cd[0].date)), s('', fmt(mid)), s('', 'now'));

    let best = cd[0];
    for (const d of cd) if (d.count > best.count) best = d;
    let longest = 0;
    let run = 0;
    for (const d of cd) { run = d.count ? run + 1 : 0; longest = Math.max(longest, run); }
    let current = 0;
    for (let i = cd.length - 1; i >= 0; i--) {
      if (cd[i].count) current++;
      else if (i === cd.length - 1) continue; // today may still be empty
      else break;
    }
    const thisWeek = sums[sums.length - 1];
    const stats = h('div', { class: 'stats' },
      h('div', null, h('b', null, D.contributions.total_last_year), ' in the last year'),
      h('div', null, 'peak week ', h('b', null, max)),
      h('div', null, 'busiest day ', h('b', null, best.count), s('dim', ' ' + best.date.slice(5))),
      h('div', null, 'this week ', h('b', null, thisWeek)),
      h('div', null, 'streak ', h('b', null, current + 'd'), s('dim', ' (best ' + longest + 'd)')),
      h('div', null, a(D.profile.html_url, 'github →')));
    const graph = h('div', { class: 'graph' }, bars, axis, stats);
    $('graph').replaceChildren(graph);

    // SVG bars on whole pixels (integer width + gap, crispEdges). Flex items of fractional
    // width blurred at 1x. Re-laid out only when the panel's width actually changes.
    let lastW = -1;
    const draw = () => {
      const W = Math.floor(graph.getBoundingClientRect().width);
      if (W === lastW) return;
      lastW = W;
      const n = sums.length;
      let fit = { gap: 1, bw: 2 };
      let spare = Infinity;
      for (const gap of [1, 2]) {
        const bw = Math.floor((W + gap) / n) - gap;
        const left = W - (n * (bw + gap) - gap);
        if (bw >= 2 && left < spare) { fit = { gap, bw }; spare = left; }
      }
      const { gap, bw } = fit;
      const total = n * (bw + gap) - gap;
      const H = parseInt(getComputedStyle(graph).getPropertyValue('--h'), 10) - 2;
      const art = svg('svg', { width: total, height: H, viewBox: `0 0 ${total} ${H}`, 'shape-rendering': 'crispEdges', 'aria-hidden': 'true', focusable: 'false' },
        svg('defs', null, svg('linearGradient', { id: 'bars-grad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: H, x2: 0, y2: 0 },
          svg('stop', { offset: 0, class: 'g' }), svg('stop', { offset: 0.65, class: 'y' }), svg('stop', { offset: 1, class: 'p' }))),
        weeks.map((w, i) => {
          const bh = sums[i] ? Math.max(1, Math.round((sums[i] / max) * H)) : 1;
          return svg('rect', { x: i * (bw + gap), y: H - bh, width: bw, height: bh, class: sums[i] ? '' : 'zero' }, svg('title', null, 'week of ' + w[0].date + ': ' + sums[i]));
        }));
      graph.style.setProperty('--gw', total + 'px');
      bars.replaceChildren(art);
    };
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(graph);
    else draw();
  }

  // ---------- repos ----------
  function computeList() {
    const q = state.q.trim().toLowerCase();
    let list = D.repos;
    if (q) list = list.filter((r) => [r.name, r.description, r.language || '', ...r.topics].join(' ').toLowerCase().includes(q));
    const by = {
      pushed: (x, y) => y.pushed_at.localeCompare(x.pushed_at),
      name: (x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }),
      stars: (x, y) => y.stars - x.stars || y.pushed_at.localeCompare(x.pushed_at),
      lang: (x, y) => (x.language || '~').localeCompare(y.language || '~') || y.pushed_at.localeCompare(x.pushed_at),
    }[state.sort];
    return list.slice().sort(by);
  }

  function renderRepos(keepName) {
    const prev = keepName || (state.list[state.sel] && state.list[state.sel].name);
    state.list = computeList();
    const idx = state.list.findIndex((r) => r.name === prev);
    state.sel = idx >= 0 ? idx : 0;
    const narrow = narrowMQ.matches;
    const ul = $('repos');
    if (!state.list.length) {
      ul.replaceChildren(h('li', { class: 'empty' }, 'no repos match "' + state.q + '" — ', h('kbd', null, 'Esc'), ' to clear'));
    } else {
      ul.replaceChildren(...state.list.map((r, i) => {
        const st = stOf(r);
        const tag = tagOf(r.name);
        const btn = h('button', {
          type: 'button',
          id: 'r-' + r.name,
          tabindex: i === state.sel ? '0' : '-1',
          'data-i': i,
          'aria-expanded': narrow ? String(state.open === r.name) : null,
          'aria-current': !narrow && i === state.sel ? 'true' : null,
        },
        s('c-st st-' + st, st),
        s('c-name', r.name, tag ? s('tag', ' ' + tag) : ''),
        s('c-lang ' + langCls(r.language), r.language || '—'),
        s('c-star', r.stars ? String(r.stars) : ''),
        s('c-age', agoShort(r.pushed_at)),
        s('c-desc', r.description || ''));
        const li = h('li', { class: (i === state.sel ? 'sel' : '') + (narrow && state.open === r.name ? ' open' : '') }, btn);
        if (narrow && state.open === r.name) li.append(h('div', { class: 'inline det' }, detail(r)));
        return li;
      }));
    }
    const meta = ' · sort: ' + state.sort + ' · ' + state.list.length + (state.q ? ' · /' + state.q : '');
    $('repo-meta').textContent = meta;
    document.querySelector('[data-act="sort"]').lastChild.textContent = narrowMQ.matches ? 'Sort' : 'Sort:' + state.sort;
    renderDetail();
  }

  function select(i, focus) {
    if (!state.list.length) return;
    i = Math.max(0, Math.min(state.list.length - 1, i));
    const ul = $('repos');
    const old = ul.children[state.sel];
    if (old) {
      old.classList.remove('sel');
      const b = old.querySelector('button');
      b.tabIndex = -1;
      b.removeAttribute('aria-current');
    }
    state.sel = i;
    const li = ul.children[i];
    li.classList.add('sel');
    const btn = li.querySelector('button');
    btn.tabIndex = 0;
    if (!narrowMQ.matches) btn.setAttribute('aria-current', 'true');
    if (focus) btn.focus({ preventScroll: true });
    li.scrollIntoView({ block: 'nearest' });
    renderDetail();
  }

  function detail(r, keys) {
    const f = featOf(r.name);
    const st = stOf(r);
    const desc = (f && f.summary) || r.description;
    const kv = [];
    if (f) kv.push(h('dt', null, 'stack'), h('dd', null, f.stack.join(' · ')));
    if (r.topics.length) kv.push(h('dt', null, 'topics'), h('dd', null, r.topics.map((t) => s('topic', t))));
    kv.push(h('dt', null, 'pushed'), h('dd', null, r.pushed_at.slice(0, 10), s('dim', ' (' + ago(r.pushed_at) + ')')));
    kv.push(h('dt', null, 'created'), h('dd', null, r.created_at.slice(0, 10)));
    kv.push(h('dt', null, 'repo'), h('dd', null, a(r.url)));
    if (r.homepage) kv.push(h('dt', null, 'web'), h('dd', null, a(r.homepage)));
    return [
      h('h3', null, r.name),
      h('div', { class: 'meta' }, s('st-' + st, st), ' · ', s(langCls(r.language), r.language || 'no language'), ' · ★ ' + r.stars),
      desc ? h('p', null, desc) : h('p', { class: 'dim' }, 'no description'),
      h('dl', { class: 'kv' }, kv),
      h('div', { class: 'acts' },
        h('a', { href: r.url, target: '_blank', rel: 'noopener' }, keys ? [h('kbd', null, '↵'), ' open repo'] : 'open repo ↗'),
        r.homepage ? h('a', { href: r.homepage, target: '_blank', rel: 'noopener' }, keys ? [h('kbd', null, 'w'), ' website'] : 'website ↗') : ''),
    ];
  }

  function renderDetail() {
    const r = state.list[state.sel];
    const box = $('det');
    if (!r) { box.replaceChildren(h('p', { class: 'dim' }, 'nothing selected')); return; }
    box.replaceChildren(h('div', { class: 'det' }, detail(r, true)));
  }

  function openSel(web) {
    const r = state.list[state.sel];
    if (!r) return;
    const url = web ? r.homepage : r.url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  // ---------- activity ----------
  function renderAct() {
    const label = { pr: null, push: 'pushed', release: 'release' };
    $('act').replaceChildren(...D.activity.map((e) => {
      const when = new Date(e.at);
      const repo = s('repo', shortRepo(e.repo));
      let line;
      if (e.kind === 'pr') line = [repo, ' ', a(e.url, '#' + e.number), ' ', e.title];
      else if (e.kind === 'push') line = [repo, s('dim', ' ' + e.count + '× → ' + e.branch)];
      else if (e.kind === 'release') line = [repo, ' ', a(e.url, e.tag)];
      else line = [a(e.url, shortRepo(e.repo))];
      return h('li', null,
        h('time', { class: 'when', datetime: e.at, title: when.toString() }, e.at.slice(5, 10)),
        s('what k-' + e.kind, label[e.kind] || e.action),
        h('span', { class: 'line' }, line));
    }));
  }

  // ---------- posts (same list as the terminal's `blog` and /blog/) ----------
  function renderPosts(P) {
    if (P.error) {
      $('posts').replaceChildren(h('p', { class: 'dim' }, 'could not load posts (' + P.error + ') — ', a('/blog/', 'chrispan.me/blog')));
      return;
    }
    $('post-meta').textContent = ' · ' + P.list.length + ' on the blog';
    $('posts').replaceChildren(
      h('ol', { class: 'posts', 'aria-label': 'Blog posts' }, P.list.map((x) => h('li', null,
        h('time', { datetime: x.date }, x.date),
        h('a', { href: x.url, title: x.summary || null }, x.title)))),
      h('p', { class: 'more dim' }, h('a', { href: '/blog/' }, 'all posts →'), ' · ', h('a', { href: '/feed.xml' }, 'rss')));
  }

  // ---------- search / help ----------
  const fkeys = $('fkeys');
  const search = $('search');
  const q = $('q');
  function openSearch() {
    fkeys.hidden = true;
    search.hidden = false;
    q.value = state.q;
    q.focus();
  }
  function closeSearch(clear) {
    if (clear) { state.q = ''; renderRepos(); }
    search.hidden = true;
    fkeys.hidden = false;
    const b = $('repos').querySelector('li.sel button');
    if (b) b.focus({ preventScroll: true });
  }
  q.addEventListener('input', () => {
    state.q = q.value;
    state.sel = 0;
    renderRepos('\0');
  });
  search.addEventListener('submit', (e) => { e.preventDefault(); closeSearch(false); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); closeSearch(false); }
  });

  const help = $('help');
  function openHelp() { if (!help.open) help.showModal(); }
  help.addEventListener('keydown', (e) => { if (e.key === 'q' || e.key === '?') { e.preventDefault(); help.close(); } });
  help.addEventListener('click', (e) => { if (e.target === help) help.close(); });

  function cycleSort() {
    state.sort = SORTS[(SORTS.indexOf(state.sort) + 1) % SORTS.length];
    renderRepos();
    $('repos').children[state.sel]?.scrollIntoView({ block: 'nearest' });
  }

  const ACTIONS = {
    help: openHelp,
    search: openSearch,
    'search-close': () => closeSearch(true),
    sort: cycleSort,
    open: () => openSel(false),
    web: () => openSel(true),
  };
  $('keys').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) ACTIONS[b.dataset.act]();
  });

  // ---------- repo list pointer ----------
  $('repos').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (narrowMQ.matches) {
      const r = state.list[i];
      state.open = state.open === r.name ? null : r.name;
      state.sel = i;
      renderRepos(r.name);
      $('r-' + r.name)?.focus({ preventScroll: true });
    } else {
      select(i, true);
    }
  });
  $('repos').addEventListener('dblclick', (e) => {
    if (!narrowMQ.matches && e.target.closest('button[data-i]')) openSel(false);
  });

  // ---------- global keys ----------
  const PANELS = ['p-prof', 'p-lang', 'p-graph', 'p-repo', 'p-det', 'p-act', 'p-post', 'p-work'];
  function focusPanel(n) {
    const id = PANELS[n - 1];
    if (!id) return;
    if (id === 'p-repo') {
      const b = $('repos').querySelector('li.sel button');
      if (b) { b.focus(); return; }
    }
    if (id === 'p-act') { $('act').focus(); return; }
    if (id === 'p-post') { const l = $('posts').querySelector('a'); if (l) { l.focus(); return; } }
    const el = $(id);
    if (getComputedStyle(el).display === 'none') return;
    el.focus();
    el.scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', (e) => {
    if (!D || help.open) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.matches && t.matches('input, textarea, select')) return;
    const inAct = t.closest && t.closest('#act');
    switch (e.key) {
      case 'j': case 'ArrowDown':
        if (inAct) return;
        e.preventDefault(); select(state.sel + 1, true); break;
      case 'k': case 'ArrowUp':
        if (inAct) return;
        e.preventDefault(); select(state.sel - 1, true); break;
      case 'g': case 'Home':
        if (inAct) return;
        e.preventDefault(); select(0, true); break;
      case 'G': case 'End':
        if (inAct) return;
        e.preventDefault(); select(state.list.length - 1, true); break;
      case 'Enter': case 'o':
        if (t.closest && t.closest('a, dialog, #keys, .work-languages')) return;
        if (narrowMQ.matches && e.key === 'Enter' && t.closest && t.closest('#repos')) return; // let the button toggle
        e.preventDefault(); openSel(false); break;
      case 'w': e.preventDefault(); openSel(true); break;
      case 's': e.preventDefault(); cycleSort(); break;
      case '/': e.preventDefault(); openSearch(); break;
      case '?': e.preventDefault(); openHelp(); break;
      case 'Escape': if (state.q) { state.q = ''; renderRepos(); } break;
      default:
        if (/^[1-8]$/.test(e.key)) { e.preventDefault(); focusPanel(Number(e.key)); }
    }
  });

  narrowMQ.addEventListener('change', () => { state.open = null; renderRepos(); });

  // ---------- boot ----------
  // Same sources as the homepage terminal: /data.json and the blog build's /blog/posts.json.
  const json = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  Promise.all([json('/data.json'), json('/blog/posts.json').then((x) => ({ list: x.posts }), (err) => ({ list: [], error: err.message }))])
    .then(([d, posts]) => {
      D = d;
      renderPosts(posts);
      renderHead();
      renderProf();
      renderWork();
      renderLang();
      renderGraph();
      renderRepos();
      renderAct();
      $('app').classList.remove('loading');
    })
    .catch((err) => {
      $('app').classList.remove('loading');
      $('prof').replaceChildren(h('p', null, 'failed to load data.json (' + err.message + ') — ', a('https://github.com/szupzj18')));
    });
})();
