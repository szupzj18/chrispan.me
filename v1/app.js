'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const out = $('#out');
  const form = $('#line');
  const input = $('#cmd');
  const ps1 = $('#ps1');
  const chips = $('#chips');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  let D = null;
  let cwd = '~';
  let block = null;
  let cancelBoot = null;

  // ---------- dom helpers ----------
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
  const s = (cls, ...k) => h('span', { class: cls }, ...k);
  const pretty = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const a = (url, text) => h('a', { href: url, target: '_blank', rel: 'noopener' }, text || pretty(url));
  const run = (cmd, text, cls) => h('button', { type: 'button', class: 'run ' + (cls || ''), 'data-cmd': cmd }, text || cmd);
  const pad = (str, n) => ' '.repeat(Math.max(0, n - str.length));
  const print = (...kids) => block.append(h('div', { class: 'ln' }, ...kids));
  // indented line whose wrapped continuation keeps the indent
  const printi = (...kids) => block.append(h('div', { class: 'ln ind' }, ...kids));
  const blank = () => print('');
  const langCls = (l) => 'lang-' + (l ? l.toLowerCase().replace(/[^a-z]+/g, '') : 'none');
  const shortRepo = (full) => full.startsWith(D.profile.login + '/') ? full.slice(D.profile.login.length + 1) : full;
  const narrow = () => out.clientWidth < 600;

  function cols() {
    const probe = s('', 'MMMMMMMMMM');
    out.append(probe);
    const w = probe.getBoundingClientRect().width / 10;
    probe.remove();
    return Math.floor(out.clientWidth / (w || 8.4));
  }

  // ---------- history ----------
  const HKEY = 'chrispan.v1.history';
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(HKEY) || '[]').slice(-100); } catch { hist = []; }
  let hi = hist.length;
  let draft = '';
  function remember(line) {
    if (hist[hist.length - 1] !== line) hist.push(line);
    hist = hist.slice(-100);
    hi = hist.length;
    try { localStorage.setItem(HKEY, JSON.stringify(hist)); } catch { /* storage unavailable */ }
  }

  // ---------- virtual filesystem ----------
  const FILES = {
    'about.txt': () => catAbout(),
    'now.txt': () => catNow(),
    'skills.txt': () => catSkills(),
    'links.txt': () => catLinks(),
    '.plan': () => catNow(),
  };
  const DIRS = { repos: () => D.own, forks: () => D.forks };

  function resolve(path) {
    let parts = cwd === '~' ? [] : cwd.slice(2).split('/');
    if (path === '~') parts = [];
    else if (path) {
      if (path.startsWith('~')) { parts = []; path = path.slice(1); }
      else if (path.startsWith('/')) { parts = []; }
      for (const seg of path.split('/')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') parts.pop();
        else parts.push(seg);
      }
    }
    if (parts.length === 0) return { type: 'dir', path: '~' };
    if (parts.length === 1 && FILES[parts[0]]) return { type: 'file', path: '~/' + parts[0], name: parts[0] };
    if (parts.length === 1 && DIRS[parts[0]]) return { type: 'dir', path: '~/' + parts[0], name: parts[0] };
    if (parts.length === 2 && DIRS[parts[0]]) {
      const repo = DIRS[parts[0]]().find((r) => r.name.toLowerCase() === parts[1].toLowerCase());
      if (repo) return { type: 'repo', path: '~/' + parts[0] + '/' + repo.name, repo };
    }
    return null;
  }

  function entriesOf(dirPath, all) {
    if (dirPath === '~') {
      const names = Object.keys(FILES).filter((n) => all || !n.startsWith('.'));
      return [...names.map((n) => ({ name: n, kind: 'file' })), ...Object.keys(DIRS).map((n) => ({ name: n + '/', kind: 'dir' }))];
    }
    const key = dirPath.slice(2);
    return DIRS[key]().map((r) => ({ name: r.name, kind: 'repo' }));
  }

  function findRepo(name) {
    if (!name) return null;
    const n = name.replace(/\/$/, '').split('/').pop().toLowerCase();
    return D.repos.find((r) => r.name.toLowerCase() === n) || null;
  }

  function repoPath(r) { return (r.fork ? '~/forks/' : '~/repos/') + r.name; }

  // ---------- renderers ----------
  function catAbout() {
    const p = D.profile;
    print(s('h', p.name), s('dim', ' (@' + p.login + ')'));
    print(p.tagline);
    blank();
    print(p.now);
    blank();
    print(s('dim', 'always learning: '), D.learning);
    blank();
    print(D.hello, s('dim', '  → '), run('cat links.txt', 'links.txt', 'file'));
  }

  function catNow() {
    print(s('y b', '● currently building'));
    for (const b of D.building) {
      printi(run('cat ' + repoPath(findRepo(b.name)), b.name), s('dim', '  ' + b.stack.join(' · ')));
      printi(b.summary);
      printi(a(b.url));
    }
    blank();
    print(s('y b', '● featured'));
    for (const f of D.featured) {
      printi(run('cat ' + repoPath(findRepo(f.name)), f.name), s('dim', '  ' + f.stack.join(' · ')));
      printi(f.summary);
      printi(a(f.homepage || f.url));
    }
  }

  function catSkills() {
    const w = Math.max(...D.skills.map((k) => k.area.length)) + 2;
    for (const k of D.skills) {
      if (narrow()) {
        print(s('pu b', k.area));
        printi(k.items.join(', '));
      } else {
        print(s('pu b', k.area), pad(k.area, w), k.items.join(', '));
      }
    }
  }

  function catLinks() {
    for (const l of D.links) print(s('dim', '» '), s('b', l.label), pad(l.label, 8), a(l.url));
    print(s('dim', '» '), s('b', 'Web'), pad('Web', 8), a('https://' + D.profile.domain + '/', D.profile.domain));
  }

  function repoCard(r) {
    const feat = [...D.building, ...D.featured].find((f) => f.name === r.name);
    print(s('bl b', r.name), r.fork ? s('dim', ' (fork)') : '', '  ',
      s(langCls(r.language), r.language || '—'), s('dim', '  ★ ' + r.stars + '  pushed ' + r.pushed_at.slice(0, 10)));
    const desc = (feat && feat.summary) || r.description;
    if (desc) printi(desc);
    if (feat) printi(s('dim', 'stack  '), feat.stack.join(' · '));
    if (r.topics.length) printi(s('dim', 'topics '), s('c', r.topics.join(' ')));
    printi(s('dim', 'repo   '), a(r.url));
    if (r.homepage) printi(s('dim', 'web    '), a(r.homepage));
    printi(s('dim', '→ '), run('open ' + r.name), r.homepage ? [s('dim', '  '), run('open ' + r.name + ' --web')] : '');
  }

  function lsRepos(list, title) {
    print(s('dim', 'total ' + list.length + ' · ' + title + ' · newest push first'));
    const w = Math.min(22, Math.max(...list.map((r) => r.name.length)));
    const lw = 11;
    const room = cols() - (10 + 2 + lw + 5 + 2 + w + 2);
    for (const r of list) {
      const lang = r.language || '—';
      const name = run('cat ' + repoPath(r), r.name);
      if (narrow()) {
        print(s('dim', r.pushed_at.slice(0, 10)), '  ', s(langCls(r.language), lang), pad(lang, lw), name);
        if (r.description) printi(s('dim', clip(r.description, cols() - 3)));
      } else {
        const star = r.stars ? '★' + r.stars : '';
        print(s('dim', r.pushed_at.slice(0, 10)), '  ', s(langCls(r.language), lang), pad(lang, lw),
          s('y', star), pad(star, 5), name, pad(r.name, w + 2), s('dim', clip(r.description, room)));
      }
    }
  }

  function clip(str, n) {
    if (!str) return '';
    if (n < 12) return '';
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  const LOGO = [
    ' ▄█████▄  ██████▄ ',
    '██▀   ▀▀  ██    ██',
    '██        ██████▀ ',
    '██▄   ▄▄  ██      ',
    ' ▀█████▀  ██      ',
  ];

  function years(since) {
    const a0 = new Date(since);
    const now = new Date();
    let m = (now.getFullYear() - a0.getFullYear()) * 12 + now.getMonth() - a0.getMonth();
    if (now.getDate() < a0.getDate()) m--;
    return Math.floor(m / 12) + ' years, ' + (m % 12) + ' months';
  }

  function neofetch() {
    const p = D.profile;
    const logo = h('div', { class: 'logo', 'aria-hidden': 'true' }, LOGO.map((l, i) => h('div', { class: 'l' + i }, l)));
    const info = h('div', { class: 'info' });
    const row = (k, v) => info.append(h('div', { class: 'ln' }, s('g b', k), s('dim', ': '), v));
    info.append(h('div', { class: 'ln' }, s('g b', 'chris'), '@', s('g b', p.domain)));
    info.append(h('div', { class: 'ln dim' }, '─'.repeat(5 + 1 + p.domain.length)));
    row('Name', p.name + ' (' + p.login + ')');
    row('Role', 'Software Engineer');
    row('Focus', 'AI infra & coding agents');
    row('Uptime', years(p.created_at) + ' on GitHub');
    row('Packages', D.own.length + ' repos, ' + D.forks.length + ' forks');
    row('Langs', D.languages.slice(0, 5).map((l) => l.name).join(', '));
    row('Building', D.building.map((b) => b.name).join(', '));
    row('Featured', D.featured.map((f) => f.name).join(', '));
    row('Contribs', D.contributions.total_last_year + ' contributions / last year');
    row('Social', p.followers + ' followers · ' + p.following + ' following');
    info.append(h('div', { class: 'ln' }, ''));
    info.append(h('div', { class: 'ln swatch', 'aria-hidden': 'true' },
      ['r', 'o', 'y', 'g', 'c', 'bl', 'pu', 'h'].map((c) => s(c, '███'))));
    block.append(h('div', { class: 'fetch' }, logo, info));
  }

  function activityLine(e) {
    const repo = shortRepo(e.repo);
    switch (e.kind) {
      case 'pr': return [s('pu', e.action.padEnd(9)), repo + ' ', a(e.url, '#' + e.number), ' ', e.title];
      case 'push': return [s('g', 'pushed'.padEnd(9)), repo + ' ', s('dim', e.count + '× to ' + e.branch)];
      case 'release': return [s('y', 'released'.padEnd(9)), repo + ' ', a(e.url, e.tag)];
      case 'comment': return [s('c', 'comment'.padEnd(9)), repo + ' ', a(e.url, '#' + e.number), ' ', e.title];
      case 'fork': return [s('o', 'forked'.padEnd(9)), a(e.url, repo)];
      case 'star': return [s('y', 'starred'.padEnd(9)), a(e.url, repo)];
      default: return [e.kind, ' ', repo];
    }
  }

  function gitLog(n) {
    const list = D.activity.slice(0, n);
    for (const e of list) {
      const d = new Date(e.at);
      const stamp = e.at.slice(0, 10);
      print(s('y', '* '), s('y', stamp), ' ', h('span', { title: d.toString() }, activityLine(e)));
    }
    print(s('dim', '(public events · '), a(D.profile.html_url + '?tab=overview', 'full activity'), s('dim', ')'));
  }

  function heatmap() {
    const days = D.contributions.days;
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    const n = Math.max(8, Math.min(weeks.length, cols() - 5));
    const shown = weeks.slice(-n);
    const months = ' '.repeat(shown.length).split('');
    let last = '';
    shown.forEach((w, i) => {
      const m = new Date(w[0].date + 'T00:00:00').toLocaleString('en', { month: 'short' });
      if (m !== last) {
        if (i + 3 <= shown.length) for (let j = 0; j < 3; j++) months[i + j] = m[j];
        last = m;
      }
    });
    const wrap = h('div', { class: 'heat', role: 'img', 'aria-label': D.contributions.total_last_year + ' contributions in the last year' });
    wrap.append(h('div', { class: 'ln dim' }, '    ' + months.join('')));
    const labels = ['   ', 'Mon', '   ', 'Wed', '   ', 'Fri', '   '];
    for (let r = 0; r < 7; r++) {
      const line = h('div', { class: 'ln' }, s('dim', labels[r] + ' '));
      for (const w of shown) {
        const d = w[r];
        line.append(d ? h('span', { class: 'h' + d.level, title: d.count + ' on ' + d.date }, '■') : ' ');
      }
      wrap.append(line);
    }
    block.append(wrap);
    print('');
    print(s('dim', '    less '), ['h0', 'h1', 'h2', 'h3', 'h4'].map((c) => h('span', { class: 'heat' }, s(c, '■'))), s('dim', ' more   '),
      s('g b', String(D.contributions.total_last_year)), s('dim', ' contributions in the last year'));
  }

  // ---------- commands ----------
  const CMDS = {
    help: { d: 'list commands', fn: help },
    whoami: { d: 'who is this', fn: () => {
      print(s('g b', D.profile.name), s('dim', ' · '), D.profile.tagline);
      print(s('dim', 'try '), run('cat about.txt'), s('dim', ', '), run('ls repos'), s('dim', ' or '), run('neofetch'));
    } },
    neofetch: { d: 'system info, but it is a person', fn: neofetch },
    ls: { d: 'list files · ls repos · ls forks', usage: 'ls [-a] [dir]', complete: (cur) => pathCands(cur), fn: ls },
    cd: { d: 'change directory', usage: 'cd <dir>', complete: (cur) => pathCands(cur, true), fn: cd },
    cat: { d: 'print a file or a repo card', usage: 'cat <file|repo>', complete: (cur) => pathCands(cur), fn: cat },
    open: { d: 'open a repo or link in a new tab', usage: 'open <repo|github> [--web]', complete: () => ['github', ...D.repos.map((r) => r.name)], fn: open },
    log: { d: 'recent public activity (git log style)', usage: 'log [-n N]', fn: (args) => {
      const i = args.indexOf('-n');
      gitLog(i >= 0 ? Math.max(1, parseInt(args[i + 1], 10) || 10) : 12);
    } },
    contrib: { d: 'contribution heatmap', fn: heatmap },
    grep: { d: 'search repos by name, description, topic', usage: 'grep <pattern>', fn: grep },
    pwd: { d: 'print working directory', fn: () => print(cwd.replace('~', '/home/chris')) },
    history: { d: 'command history', fn: () => hist.forEach((l, i) => print(s('dim', String(i + 1).padStart(4) + '  '), run(l, l, 'file'))) },
    clear: { d: 'clear the screen (Ctrl+L)', fn: () => { out.textContent = ''; } },
    echo: { hidden: true, fn: (args) => print(args.join(' ')) },
    date: { hidden: true, fn: () => print(new Date().toString()) },
    uname: { hidden: true, fn: () => print('chrispan.me 1.0 static-html x86_64-in-your-browser') },
    sudo: { hidden: true, fn: () => print(s('r', 'chris is the only one in the sudoers file. This incident will be reported.')) },
    exit: { hidden: true, fn: () => print(s('dim', 'there is no exit — but there is '), run('open github')) },
    man: { hidden: true, fn: () => print(s('dim', 'no manual entry; try '), run('help')) },
    vim: { hidden: true, fn: () => print(s('dim', 'you are now trapped in vim. just kidding — :q')) },
    git: { hidden: true, fn: (args) => {
      if (args[0] === 'log') return CMDS.log.fn(args.slice(1));
      print(s('dim', 'only '), run('git log'), s('dim', ' is wired up here'));
    } },
  };
  const ALIASES = { '?': 'help', about: 'cat about.txt', skills: 'cat skills.txt', links: 'cat links.txt', contact: 'cat links.txt', now: 'cat now.txt', repos: 'ls repos', forks: 'ls forks', ll: 'ls -a', dir: 'ls', cls: 'clear', fetch: 'neofetch' };

  function help() {
    print(s('dim', 'commands — type them, or tap them. Tab completes, ↑/↓ walks history.'));
    blank();
    const list = Object.entries(CMDS).filter(([, c]) => !c.hidden);
    const w = Math.max(...list.map(([n, c]) => (c.usage || n).length)) + 3;
    for (const [n, c] of list) {
      const u = c.usage || n;
      if (narrow()) {
        print(run(n === 'ls' ? 'ls repos' : n === 'cat' ? 'cat about.txt' : n, u, 'cmdname'));
        printi(s('dim', c.d));
      } else {
        print(run(n === 'ls' ? 'ls repos' : n === 'cat' ? 'cat about.txt' : n, u, 'cmdname'), pad(u, w), s('dim', c.d));
      }
    }
    blank();
    print(s('dim', 'shortcuts: '), ['about', 'now', 'skills', 'links', 'repos'].map((x, i) => [i ? s('dim', ' · ') : '', run(x, x, 'cmdname')]));
  }

  function ls(args) {
    const all = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const target = args.find((x) => !x.startsWith('-'));
    const node = resolve(target || '');
    if (!node) return print(s('r', 'ls: ' + target + ': No such file or directory'));
    if (node.type === 'file') return print(run('cat ' + node.path, node.name, 'file'));
    if (node.type === 'repo') return repoCard(node.repo);
    if (node.path === '~/repos') return lsRepos(D.own, 'my repos');
    if (node.path === '~/forks') return lsRepos(D.forks, 'forks');
    const items = entriesOf(node.path, all);
    print(items.map((e, i) => [i ? '  ' : '',
      e.kind === 'dir' ? run('ls ~/' + e.name.slice(0, -1), e.name) : run('cat ~/' + e.name, e.name, 'file')]));
  }

  function cd(args) {
    const target = args[0] || '~';
    const node = resolve(target === '-' ? '~' : target);
    if (!node) return print(s('r', 'cd: no such file or directory: ' + target));
    if (node.type !== 'dir') return print(s('r', 'cd: not a directory: ' + target));
    cwd = node.path;
    renderPrompt();
  }

  function cat(args) {
    if (!args.length) return print(s('dim', 'usage: cat <file|repo>  ·  try '), run('cat about.txt'));
    for (const arg of args) {
      const node = resolve(arg) || (findRepo(arg) && { type: 'repo', repo: findRepo(arg) });
      if (!node) print(s('r', 'cat: ' + arg + ': No such file or directory'));
      else if (node.type === 'dir') print(s('r', 'cat: ' + arg + ': Is a directory'), s('dim', ' · try '), run('ls ' + arg));
      else if (node.type === 'repo') repoCard(node.repo);
      else FILES[node.name]();
    }
  }

  function open(args) {
    const target = args.find((x) => !x.startsWith('-'));
    const web = args.includes('--web') || args.includes('-w');
    let url = null;
    if (!target) return print(s('dim', 'usage: open <repo|github> [--web]'));
    const t = target.toLowerCase();
    if (t === 'github' || t === 'gh') url = D.profile.html_url;
    else {
      const r = findRepo(t);
      if (r) url = web && r.homepage ? r.homepage : r.url;
      else {
        const l = D.links.find((x) => x.label.toLowerCase() === t);
        if (l) url = l.url;
      }
    }
    if (!url) return print(s('r', 'open: ' + target + ': not found'), s('dim', ' · try '), run('ls repos'));
    window.open(url, '_blank', 'noopener');
    print(s('dim', 'opening '), a(url));
  }

  function grep(args) {
    const q = args.join(' ').toLowerCase();
    if (!q) return print(s('dim', 'usage: grep <pattern>  ·  e.g. '), run('grep agent'));
    const hits = D.repos.filter((r) => [r.name, r.description, r.language || '', ...r.topics].join(' ').toLowerCase().includes(q));
    if (!hits.length) return print(s('dim', 'no matches for "' + q + '"'));
    lsRepos(hits, 'matching "' + q + '"');
  }

  // ---------- completion ----------
  function pathCands(cur, dirsOnly) {
    const slash = cur.lastIndexOf('/');
    const base = slash >= 0 ? cur.slice(0, slash + 1) : '';
    const node = resolve(base || '.');
    if (!node || node.type !== 'dir') return [];
    return entriesOf(node.path, cur.slice(slash + 1).startsWith('.'))
      .filter((e) => !dirsOnly || e.kind === 'dir')
      .map((e) => base + e.name);
  }

  function complete() {
    const v = input.value;
    const parts = v.split(/\s+/);
    const cur = parts[parts.length - 1];
    let cands;
    if (parts.length === 1) cands = [...Object.keys(CMDS).filter((k) => !CMDS[k].hidden), ...Object.keys(ALIASES)];
    else {
      const c = CMDS[parts[0]];
      cands = c && c.complete ? c.complete(cur) : [];
    }
    const lc = cur.toLowerCase();
    const m = [...new Set(cands)].filter((x) => x.toLowerCase().startsWith(lc)).sort();
    if (!m.length) return;
    const head = parts.slice(0, -1).join(' ') + (parts.length > 1 ? ' ' : '');
    if (m.length === 1) {
      input.value = head + m[0] + (m[0].endsWith('/') ? '' : ' ');
      return;
    }
    const pre = commonPrefix(m);
    if (pre.length > cur.length) { input.value = head + pre; return; }
    // list candidates like a double-tab
    const entry = newEntry(v);
    block = entry.blk;
    print(m.map((x, i) => [i ? '  ' : '', s('bl', x)]));
    scrollAfter(entry.el);
  }
  function commonPrefix(list) {
    let p = list[0];
    for (const x of list) while (!x.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
    return p;
  }

  // ---------- run loop ----------
  function promptNodes() {
    return h('span', { class: 'ps1' }, s('u', 'chris'), s('host', '@chrispan.me'), ':', s('p', cwd), '$');
  }
  function renderPrompt() {
    ps1.replaceChildren(...promptNodes().childNodes);
  }
  function newEntry(line) {
    const echo = h('div', { class: 'echo' }, promptNodes(), ' ', line);
    const blk = h('div', { class: 'blk' });
    const el = h('section', { class: 'entry' }, echo, blk);
    out.append(el);
    return { el, blk };
  }

  function exec(raw) {
    if (cancelBoot) cancelBoot();
    const line = raw.trim();
    const entry = newEntry(raw);
    block = entry.blk;
    if (line) remember(line);
    const expanded = line.replace(/^(\S+)/, (w) => ALIASES[w] || w);
    const [name, ...args] = expanded.split(/\s+/).filter(Boolean);
    if (name) {
      const c = CMDS[name];
      if (c) {
        try { c.fn(args); } catch (err) { print(s('r', name + ': ' + err.message)); }
      } else {
        const guess = suggest(name);
        print(s('r', 'command not found: ' + name), guess ? [s('dim', ' · did you mean '), run(guess), s('dim', '?')] : [s('dim', ' · try '), run('help')]);
      }
    }
    if (name === 'clear') return;
    scrollAfter(entry.el);
  }

  function scrollAfter(el) {
    requestAnimationFrame(() => {
      const room = innerHeight - chips.offsetHeight - 24;
      if (el.getBoundingClientRect().height > room) el.scrollIntoView({ block: 'start' });
      else form.scrollIntoView({ block: 'end' });
    });
  }

  function suggest(word) {
    let best = null;
    let bestD = 3;
    for (const k of [...Object.keys(CMDS), ...Object.keys(ALIASES)]) {
      const d = lev(word, k);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  }
  function lev(x, y) {
    const m = Array.from({ length: x.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= y.length; j++) m[0][j] = j;
    for (let i = 1; i <= x.length; i++) {
      for (let j = 1; j <= y.length; j++) {
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      }
    }
    return m[x.length][y.length];
  }

  // ---------- events ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    draft = '';
    exec(v);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp') {
      if (!hist.length) return;
      e.preventDefault();
      if (hi === hist.length) draft = input.value;
      hi = Math.max(0, hi - 1);
      input.value = hist[hi];
      requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hi = Math.min(hist.length, hi + 1);
      input.value = hi === hist.length ? draft : hist[hi];
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      out.textContent = '';
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      if (input.selectionStart !== input.selectionEnd) return; // let copy through
      e.preventDefault();
      newEntry(input.value + '^C');
      input.value = '';
      hi = hist.length;
    } else if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      input.value = '';
    } else if (e.key === 'Escape') {
      input.value = '';
    }
  });

  out.addEventListener('click', (e) => {
    const b = e.target.closest('button.run');
    if (!b) return;
    exec(b.dataset.cmd);
    if (!coarse) input.focus({ preventScroll: true });
  });

  // click on empty terminal space focuses the prompt (mouse only: on touch it would pop the keyboard)
  document.getElementById('term').addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.target.closest('a, button, input')) return;
    if (String(getSelection())) return;
    input.focus({ preventScroll: true });
  });

  const CHIPS = ['help', 'whoami', 'about', 'now', 'ls repos', 'log', 'neofetch', 'contrib', 'skills', 'links', 'clear'];
  function buildChips() {
    chips.replaceChildren(...CHIPS.map((c) => h('button', { type: 'button', 'data-cmd': c }, c)));
    chips.hidden = false;
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      exec(b.dataset.cmd);
      if (!coarse) input.focus({ preventScroll: true });
    });
  }

  // ---------- boot ----------
  function boot() {
    buildChips();
    input.disabled = false;
    const motd = h('section', { class: 'entry' });
    out.append(motd);
    block = motd;
    const last = D.activity[0];
    const now = new Date();
    const stamp = now.toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/,/g, '');
    print(s('dim', 'Last login: ' + stamp + ' on ttys001'));
    if (last) print(s('dim', 'Last push:  ' + shortRepo(last.repo) + ' · ' + last.at.slice(0, 10)));
    print(s('dim', 'Type '), run('help', 'help', 'cmdname'), s('dim', coarse ? ' or tap a command below.' : ', or press Tab to complete.'));
    if (!coarse) input.focus({ preventScroll: true });
    typeThen('neofetch');
  }

  // types one command at boot: a short, finite effect (skipped for reduced motion).
  // Any keypress or command from the visitor cancels it.
  function typeThen(cmd) {
    if (reduceMotion) { exec(cmd); return; }
    let i = 0;
    let timer = 0;
    const stop = () => {
      clearTimeout(timer);
      cancelBoot = null;
      input.removeEventListener('keydown', stop);
      input.value = '';
    };
    cancelBoot = stop;
    input.addEventListener('keydown', stop);
    const step = () => {
      input.value = cmd.slice(0, ++i);
      timer = setTimeout(i < cmd.length ? step : () => { stop(); exec(cmd); }, i < cmd.length ? 45 : 180);
    };
    timer = setTimeout(step, 250);
  }

  fetch('../data.json')
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((d) => {
      d.own = d.repos.filter((r) => !r.fork);
      d.forks = d.repos.filter((r) => r.fork);
      D = d;
      boot();
    })
    .catch((err) => {
      block = out;
      print(s('r', 'failed to load data.json (' + err.message + ')'));
      print(s('dim', 'meanwhile: '), a('https://github.com/szupzj18'));
    });
})();
