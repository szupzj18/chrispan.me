#!/usr/bin/env node
// Refreshes data.json from public GitHub data: profile counts, public non-fork repos, languages,
// recent activity on those repos, and the public contribution calendar. The hand-written parts
// (tagline, now, links, skills, selected_work, building, featured, projects_without_repo, learning, hello, pinned) are kept as they are.
//
// Run weekly by .github/workflows/pages.yml. On any fetch error or implausible result it exits
// non-zero and leaves data.json untouched, so the run fails and the live site keeps the old data.
// Uses GH_TOKEN for the REST API when set (only public endpoints are called).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data.json');
const LOGIN = 'szupzj18';
const API = 'https://api.github.com';

function fail(msg) {
  console.error('data: ' + msg + ' — data.json left unchanged');
  process.exit(1);
}

async function get(url, as = 'json') {
  const headers = { 'User-Agent': 'chrispan.me-data', Accept: 'application/vnd.github+json' };
  if (url.startsWith(API) && process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  const r = await fetch(url, { headers });
  if (!r.ok) fail(`GET ${url} → HTTP ${r.status}`);
  return as === 'json' ? r.json() : r.text();
}

const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const user = await get(`${API}/users/${LOGIN}`);
const rawRepos = await get(`${API}/users/${LOGIN}/repos?type=owner&sort=pushed&per_page=100`);
const events = await get(`${API}/users/${LOGIN}/events/public?per_page=100`);
const calendar = await get(`https://github.com/users/${LOGIN}/contributions`, 'text');

if (user.login !== LOGIN) fail('unexpected profile ' + user.login);
if (rawRepos.some((r) => r.private || r.visibility !== 'public')) fail('a non-public repo came back');

// ---- repos: public, not forks, not the profile-README repo; keep an old description if GitHub's is empty
const oldDesc = Object.fromEntries(old.repos.map((r) => [r.name, r.description]));
const repos = rawRepos.filter((r) => !r.fork && r.name !== LOGIN).map((r) => ({
  name: r.name,
  description: (r.description || oldDesc[r.name] || '').trim(),
  language: r.language,
  stars: r.stargazers_count,
  archived: r.archived,
  topics: r.topics || [],
  homepage: r.homepage || null,
  url: r.html_url,
  created_at: r.created_at,
  pushed_at: r.pushed_at,
})).sort((a, b) => b.pushed_at.localeCompare(a.pushed_at));
if (repos.length < Math.max(1, Math.ceil(old.repos.length / 2))) fail(`only ${repos.length} repos (was ${old.repos.length})`);

const count = {};
for (const r of repos) if (r.language) count[r.language] = (count[r.language] || 0) + 1;
const languages = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, repos: n }));

// ---- activity: PRs, default-branch pushes (one line per repo and day) and releases on own public repos
const own = new Set(rawRepos.filter((r) => !r.fork).map((r) => r.full_name));
const act = [];
const pushes = new Map();
for (const e of events) {
  const repo = e.repo.name;
  if (!e.public || !own.has(repo)) continue;
  const p = e.payload;
  if (e.type === 'PullRequestEvent' && ['opened', 'merged', 'closed'].includes(p.action)) {
    const pr = await get(`${API}/repos/${repo}/pulls/${p.number}`); // event payloads no longer carry titles
    act.push({ at: e.created_at, kind: 'pr', action: pr.merged ? 'merged' : p.action, repo, number: pr.number, title: pr.title, url: pr.html_url });
  } else if (e.type === 'PushEvent') {
    const branch = (p.ref || '').replace('refs/heads/', '');
    if (branch !== 'main' && branch !== 'master') continue;
    const key = e.created_at.slice(0, 10) + ' ' + repo;
    const prev = pushes.get(key);
    if (prev) { prev.count++; if (e.created_at > prev.at) prev.at = e.created_at; }
    else pushes.set(key, { at: e.created_at, kind: 'push', repo, branch, count: 1, url: `https://github.com/${repo}/commits/${branch}` });
  }
}
act.push(...pushes.values());
const since = new Date(Date.now() - 90 * 864e5).toISOString();
for (const r of repos.filter((x) => x.pushed_at >= since)) {
  for (const rel of await get(`${API}/repos/${LOGIN}/${r.name}/releases?per_page=10`)) {
    if (!rel.draft && rel.published_at) act.push({ at: rel.published_at, kind: 'release', repo: `${LOGIN}/${r.name}`, tag: rel.tag_name, title: rel.name, url: rel.html_url });
  }
}
const seen = new Set();
const activity = act.sort((a, b) => b.at.localeCompare(a.at))
  .filter((a) => a.kind !== 'pr' || (!seen.has(a.repo + '#' + a.number) && seen.add(a.repo + '#' + a.number)))
  .slice(0, 24);

// ---- contribution calendar, as a logged-out visitor sees it
const ids = Object.fromEntries([...calendar.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-\d+-\d+)"/g)].map((m) => [m[2], m[1]]));
const levels = Object.fromEntries([...calendar.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g)].map((m) => [m[1], Number(m[2])]));
const counts = {};
for (const [, id, text] of calendar.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)/g)) {
  const m = /^\s*(\d+|No) contributions?/.exec(text);
  if (ids[id]) counts[ids[id]] = !m || m[1] === 'No' ? 0 : Number(m[1]);
}
const days = Object.keys(levels).sort().map((date) => ({ date, count: counts[date] || 0, level: levels[date] }));
const totalMatch = /([\d,]+)\s+contributions?\s+in the last year/.exec(calendar.replace(/\s+/g, ' '));
const total = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0;
if (days.length < 350 || days.length > 380) fail(`contribution calendar has ${days.length} days`);
if (!total || !days.some((d) => d.count > 0)) fail('contribution count is 0 — the calendar page probably changed');

const data = {
  ...old,
  generated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  profile: { ...old.profile, avatar_url: user.avatar_url, html_url: user.html_url, location: user.location, bio: user.bio, followers: user.followers, following: user.following, created_at: user.created_at },
  languages,
  repos,
  activity,
  contributions: { total_last_year: total, days },
};
fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
console.log(`data: repos ${old.repos.length}→${repos.length}, contributions ${old.contributions.total_last_year}→${total} over ${days.length} days, activity ${activity.length}, followers ${user.followers}`);
