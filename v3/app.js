'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const man = $('man');
  const isZh = document.documentElement.lang.startsWith('zh');
  const t = (en, zh) => isZh ? zh : en;

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
    const Z = D.locales.zh;
    const own = D.repos;
    const highlighted = new Set([...D.building, ...D.featured].map((x) => x.name));
    const out = [];

    out.push(section('name', t('NAME', '名称'),
      p(b('chrispan'), t(' — ', '，'), t(P.tagline.replace(/\.$/, '').replace(/^Software Engineer/, 'software engineer'), Z.profile.tagline))));

    out.push(section('synopsis', t('SYNOPSIS', '用法'),
      h('p', { class: 'syn' }, b('chrispan'), ' [', b('--session-memory'), '] [', b('--multi-account'), '] [', b('--simulator-control'), '] ', u('coding-agent'), '…'),
      h('p', { class: 'syn' }, b('chrispan'), ' ', b('--learn'), ' ', u('how-things-work')),
      h('p', { class: 'syn' }, b('chrispan'), ' ', b('--say-hi'))));

    out.push(section('description', t('DESCRIPTION', '简介'),
      P.intro ? p(b(t(P.intro, Z.profile.intro))) : null,
      p(b(P.name), ' (', a(P.html_url, '@' + P.login), t(') is currently ', ') '), t(P.now.charAt(0).toLowerCase() + P.now.slice(1), Z.profile.now)),
      p(t('The public record: ', '公开记录：GitHub 上有 '), b(String(own.length)), t(' repositories on GitHub, ', ' 个仓库，过去一年 '),
        b(String(D.contributions.total_last_year)), t(' contributions in the last year, ', ' 次贡献，'), P.followers, t(' followers.', ' 位关注者。'))));

    if (D.selected_work?.length) out.push(section('selected-work', t('SELECTED WORK', '精选工作'),
      h('dl', null, D.selected_work.map((item) => {
        const work = isZh ? item.zh : item;
        return [h('dt', null, b(work.title)), h('dd', null, h('p', null, work.summary))];
      }))));

    const optFlags = { Languages: ['-l', '--languages'], Mobile: ['-m', '--mobile'], 'AI / Agents': ['-a', '--agents'], 'Dev Tools': ['-t', '--tools'] };
    out.push(section('options', t('OPTIONS', '技能与工具'),
      h('dl', null, D.skills.map((k) => {
        const f = optFlags[k.area] || ['', '--' + k.area.toLowerCase().replace(/[^a-z]+/g, '-')];
        const items = isZh ? Z.skills[k.area] || k.items : k.items;
        return [h('dt', null, f[0] ? [b(f[0]), ', '] : '', b(f[1])), h('dd', null, items.join(t(', ', '、')) + t('.', '。'))];
      }))));

    // hand-written projects with no public repo (e.g. a page on this site), listed first in their section
    const noRepo = (sect) => (D.projects_without_repo || []).filter((x) => x.section === sect);
    const building = [...noRepo('building'), ...D.building];
    const featured = [...noRepo('featured'), ...D.featured];
    const projDl = (list) => h('dl', null, list.map((x) => {
      const content = isZh ? { ...x, ...Z.projects[x.name] } : x;
      const r = D.repos.find((y) => y.name === x.name);
      const links = [a(r ? r.url : x.url)];
      if (x.homepage || (r && r.homepage)) links.push(' · ', a(x.homepage || r.homepage));
      else if (x.url && r && x.url !== r.url) links.push(' · ', a(x.url));
      const meta = r ? (r.language || '') + (r.stars ? ' · ★' + r.stars : '') : content.meta;
      return [
        h('dt', null, b(x.name), '(' + (x.man || 1) + ')', meta ? h('span', { class: 'meta' }, '  ' + meta) : ''),
        h('dd', null, h('p', null, content.summary),
          content.points ? h('ul', { class: 'pts' }, content.points.map((point) => h('li', null, point))) : null,
          h('p', null, h('span', { class: 'dim' }, t('Stack: ', '技术：')), content.stack.join(t(', ', '、')), t('. ', '。 '), links),
          x.credit ? h('p', null, h('span', { class: 'dim' }, (content.credit_text || x.credit.text) + ' '), h('a', { href: x.credit.url, class: 'bare' }, x.credit.link), h('span', { class: 'dim' }, ' (' + x.credit.license + ')' + t('.', '。'))) : null),
      ];
    }));
    out.push(section('building', t('CURRENTLY BUILDING', '正在开发'), projDl(building)));
    out.push(section('featured', t('FEATURED', '精选项目'), projDl(featured)));

    // same list as the terminal's `blog` and /blog/ (built from posts/*.md)
    const abs = (path) => new URL(path, location.href).href;
    out.push(section('posts', t('POSTS', '文章'), posts.error
      ? p(h('span', { class: 'dim' }, t('Could not load the post list (', '文章列表加载失败（') + posts.error + t('). See ', '）。请访问 ')), a(abs('/blog/')), t('.', '。'))
      : [h('ol', { class: 'hist posts' }, posts.list.map((x) => {
          const post = isZh ? Z.posts[x.slug] || { title: x.title, summary: '' } : x;
          return h('li', null, h('time', { datetime: x.date }, x.date),
            h('span', null, h('a', { href: abs(x.url) }, b(post.title)), post.summary ? h('span', { class: 'dim sum' }, t(' — ', '：') + post.summary) : ''));
        })),
        p(h('span', { class: 'dim' }, t('All posts: ', '全部文章：')), a(abs('/blog/')), h('span', { class: 'dim' }, ' · RSS: '), a(abs('/feed.xml')))]));

    out.push(section('repositories', t('REPOSITORIES', '公开仓库'),
      p(t('Public repositories, most recently pushed first. ', '按最近推送时间排列。'), h('span', { class: 'tag' }, '*'), t(' marks the projects above.', ' 表示上方列出的项目。')),
      h('dl', null, own.filter((r) => r.name !== 'chrispan.me').map((r) => [
        h('dt', null, h('a', { href: r.url, class: 'bare' }, b(r.name)), highlighted.has(r.name) ? h('span', { class: 'tag' }, ' *') : '',
          h('span', { class: 'meta' }, '  ' + [r.language, r.stars ? '★' + r.stars : null, r.pushed_at.slice(0, 10)].filter(Boolean).join(' · '))),
        r.description ? h('dd', null, isZh ? Z.repos[r.name] || '项目介绍见仓库。' : r.description) : null,
      ]))));

    const verb = (e) => {
      const repo = shortRepo(D, e.repo);
      switch (e.kind) {
        case 'pr': return [b(repo), ' ', a(e.url, '#' + e.number), ' ', t(e.action, { merged: '合并', opened: '创建', closed: '关闭' }[e.action] || '更新'), t(': ', '：'), isZh ? Z.activity_titles[e.url] || '代码变更' : e.title];
        case 'push': return isZh ? [b(repo), ' 向 ', u(e.branch), ' 推送 ' + e.count + '×'] : [b(repo), ' pushed ', e.count + '× to ', u(e.branch)];
        case 'release': return [b(repo), t(' released ', ' 发布 '), a(e.url, e.tag)];
        default: return [t(e.kind, '更新'), ' ', repo];
      }
    };
    out.push(section('history', t('HISTORY', '近期动态'),
      h('ol', { class: 'hist' }, D.activity.slice(0, 14).map((e) => h('li', null, h('time', { datetime: e.at }, e.at.slice(0, 10)), h('span', null, verb(e))))),
      p(h('span', { class: 'dim' }, t('From public GitHub events. Full log: ', '来自公开 GitHub 动态。完整记录：')), a(P.html_url))));

    out.push(section('exit-status', t('EXIT STATUS', '退出状态'),
      p(b('0'), t('   always. Still learning — ', '   始终继续学习。'), t(D.learning, Z.learning))));

    out.push(section('bugs', t('BUGS', '问题与交流'),
      p(t(D.hello, Z.hello), t(' Report at ', ' 联系方式：'), a(P.html_url), t('.', '。'))));

    out.push(section('see-also', t('SEE ALSO', '另请参阅'),
      p([...building, ...featured].map((x, i) => {
        const r = D.repos.find((y) => y.name === x.name);
        return [i ? ', ' : '', h('a', { href: (r && r.homepage) || x.homepage || x.url, class: 'bare' }, b(x.name), '(' + (x.man || 1) + ')')];
      }), ', ', h('a', { href: '/blog/', class: 'bare' }, b('blog'), '(7)'), ', ', h('a', { href: P.html_url, class: 'bare' }, b('github'), '(7)'), '.')));

    out.push(section('author', t('AUTHOR', '作者'),
      p(P.name, ' <', a(P.html_url), '>.'),
      p(h('span', { class: 'dim' }, t('Rendered from public GitHub data, ', '根据公开 GitHub 数据生成，') + D.generated_at.slice(0, 10) + t('.', '。')))));

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
      if (lineEl) lineEl.textContent = atEnd ? Math.round(scrollY / lh()) + 1 + '/' + Math.round(document.documentElement.scrollHeight / lh()) + t(' (END)', '（结束）') : String(Math.round(scrollY / lh()) + 1);
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
    if (!matches.length) { say([t('Pattern not found  (press ', '未找到匹配项（按 '), h('kbd', null, 'RETURN'), t(')', '）')]); return; }
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
    say(['/' + sq.value + '  ', h('span', null, t('match ' + (mi + 1) + ' of ' + matches.length + ' — ', '第 ' + (mi + 1) + '/' + matches.length + ' 项，')), h('kbd', null, 'n'), '/', h('kbd', null, 'N'), t(' next/prev', ' 下一项/上一项')]);
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
        say([h('kbd', null, 'j'), '/', h('kbd', null, 'k'), t(' line  ', ' 行滚动  '), h('kbd', null, 'space'), '/', h('kbd', null, 'b'), t(' page  ', ' 翻页  '), h('kbd', null, 'g'), '/', h('kbd', null, 'G'), t(' top/end  ', ' 页首/页尾  '), h('kbd', null, '/'), t(' search  ', ' 搜索  '), h('kbd', null, 'n'), t(' next  ', ' 下一项  '), h('kbd', null, 'q'), t(' quit', ' 退出')]);
        break;
      case 'q':
        e.preventDefault();
        say([t('there is no shell to return to — try ', '欢迎访问 '), h('a', { href: 'https://github.com/szupzj18', style: 'color:inherit' }, 'github.com/szupzj18')]);
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
      man.append(section('error', t('ERRORS', '加载失败'), p(t('Could not load data.json (', '无法加载 data.json（') + err.message + t('). See ', '）。请访问 '), a('https://github.com/szupzj18'), t('.', '。'))));
    });
})();
