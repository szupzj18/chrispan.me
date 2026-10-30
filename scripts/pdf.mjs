#!/usr/bin/env node
// Renders the man page (/v3/) to _site/v3/chrispan-resume.pdf with headless Chrome.
// Run after scripts/build.mjs. No dependencies: the Chrome DevTools Protocol over Node's built-in WebSocket.
//
// The page is opened as https://chrispan.me/v3/, but every chrispan.me request is answered from _site/
// (CDP Fetch domain): the PDF's links point at the live site, and the build never reads from it.
// Exits non-zero (failing the deploy) if Chrome is missing, the page does not finish rendering, or the
// PDF does not look right.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://chrispan.me';
const PAGE = '/v3/';
const PDF = path.join(OUT, 'v3', 'chrispan-resume.pdf');
const MAX_PAGES = 2;
const TIMEOUT_MS = 60000;
// fonts that actually carry CJK glyphs (post titles can be Chinese); anything else prints as empty boxes
const CJK_FONT = /CJK|PingFang|Hiragino|Hei|Song|Ming|Kai|WenQuanYi|Source Han|Noto (Sans|Serif) (SC|TC|JP|KR)|YaHei|SimSun|Droid Sans Fallback/i;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

let chrome = null;
let profile = null;
function fail(msg) {
  console.error('pdf: ' + msg);
  cleanup();
  process.exit(1);
}
function cleanup() {
  if (chrome && chrome.exitCode == null) chrome.kill('SIGKILL');
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
}

function findChrome() {
  const env = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (env && fs.existsSync(env)) return env;
  for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const p = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (p) return p;
    } catch { /* not on PATH */ }
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(mac)) return mac;
  return fail('Chrome not found; set CHROME_PATH');
}

function launch(bin) {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-chrome-'));
  const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank'];
  // GitHub's Ubuntu runners block Chrome's user-namespace sandbox; the page rendered here is our own build output.
  if (process.platform === 'linux' && process.env.CI) args.unshift('--no-sandbox');
  chrome = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let err = '';
    chrome.stderr.on('data', (d) => {
      err += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) resolve(m[1]);
    });
    chrome.on('exit', (code) => reject(new Error('Chrome exited (' + code + '): ' + err.slice(-400))));
  });
}

function cdp(url) {
  const ws = new WebSocket(url);
  let seq = 0;
  const pending = new Map();
  const handlers = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
    } else for (const fn of handlers) fn(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const opened = new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('DevTools socket error')); });
  return { opened, send, on: (fn) => handlers.push(fn), close: () => ws.close() };
}

function serveFromSite(url) {
  const u = new URL(url);
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(OUT, rel);
  if (!file.startsWith(OUT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return { body: fs.readFileSync(file), type: TYPES[path.extname(file)] || 'application/octet-stream' };
}

async function main() {
  if (!fs.existsSync(path.join(OUT, 'v3', 'index.html'))) fail('_site/v3/ is missing; run scripts/build.mjs first');
  const expectedPosts = JSON.parse(fs.readFileSync(path.join(OUT, 'blog', 'posts.json'), 'utf8')).posts.length;
  const expectedWork = JSON.parse(fs.readFileSync(path.join(OUT, 'data.json'), 'utf8')).selected_work?.length || 0;
  const timer = setTimeout(() => fail('timed out after ' + TIMEOUT_MS / 1000 + 's'), TIMEOUT_MS);

  const c = cdp(await launch(findChrome()));
  await c.opened;
  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => c.send(method, params, sessionId);

  c.on((m) => {
    if (m.method !== 'Fetch.requestPaused' || m.sessionId !== sessionId) return;
    const { requestId, request } = m.params;
    const hit = serveFromSite(request.url);
    const reply = hit
      ? { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: hit.type }], body: hit.body.toString('base64') }
      : { requestId, responseCode: 404, responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: '' };
    send('Fetch.fulfillRequest', reply).catch(() => {});
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: SITE + '/*', requestStage: 'Request' }] });
  await send('Page.enable');
  await send('Page.navigate', { url: SITE + PAGE });

  // v3 sets data-ready after rendering from /data.json and /blog/posts.json
  const state = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `new Promise((resolve) => {
      const check = () => document.documentElement.dataset.ready === '1'
        ? document.fonts.ready.then(() => resolve({ posts: document.querySelectorAll('#posts li').length, work: document.querySelectorAll('#selected-work dt').length, error: !!document.getElementById('error') }))
        : setTimeout(check, 50);
      check();
    })`,
  });
  const st = state.result.value;
  if (st.error || st.posts !== expectedPosts || st.work !== expectedWork) fail(`page did not render as expected (posts ${st.posts}/${expectedPosts}, selected work ${st.work}/${expectedWork}, error ${st.error})`);

  // Ask Chrome which system fonts drew each piece of CJK text; without a CJK font they come out as boxes.
  // The page is lang="en", so Han text would fall back to whichever CJK face sorts first (Noto Sans CJK JP
  // on the runner); mark it zh-CN so the PDF uses Simplified Chinese glyphs.
  await send('Runtime.evaluate', { expression: `for (const el of document.querySelectorAll('#man *'))
    if ([...el.childNodes].some((n) => n.nodeType === 3 && /[\\u3400-\\u9fff\\uf900-\\ufaff]/.test(n.nodeValue))) {
      el.dataset.cjk = '';
      if (!el.closest('[lang]:not(html)')) el.lang = 'zh-CN';
    }` });
  await send('DOM.enable');
  await send('CSS.enable');
  const { root } = await send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-cjk]' });
  const hasCjk = await send('Runtime.evaluate', { returnByValue: true, expression: `/[\\u3400-\\u9fff\\uf900-\\ufaff]/.test(document.getElementById('man').textContent)` });
  if (hasCjk.result.value && !nodeIds.length) fail('found CJK text but no element to check its font');
  const cjkFonts = new Set();
  for (const nodeId of nodeIds) {
    const { fonts } = await send('CSS.getPlatformFontsForNode', { nodeId });
    if (!fonts.some((f) => CJK_FONT.test(f.familyName + ' ' + (f.postScriptName || '')))) {
      fail('CJK text would print without a CJK font (used: ' + fonts.map((f) => f.familyName).join(', ') + '); install one, e.g. fonts-noto-cjk');
    }
    fonts.filter((f) => CJK_FONT.test(f.familyName + ' ' + (f.postScriptName || ''))).forEach((f) => cjkFonts.add(f.familyName));
  }

  const { data } = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: false, displayHeaderFooter: false, generateTaggedPDF: true });
  const pdf = Buffer.from(data, 'base64');
  const text = pdf.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const links = (text.match(/\/URI\s*\(/g) || []).length;
  if (!text.startsWith('%PDF-')) fail('output is not a PDF');
  if (pages < 1 || pages > MAX_PAGES) fail(pages + ' pages; expected 1-' + MAX_PAGES);
  if (!text.includes('(' + SITE + '/blog/')) fail('no clickable links to ' + SITE + '/blog/ in the PDF');
  if (text.includes('127.0.0.1') || text.includes('localhost')) fail('the PDF links to a local address');
  fs.writeFileSync(PDF, pdf);

  clearTimeout(timer);
  await c.send('Browser.close').catch(() => {});
  c.close();
  cleanup();
  const cjk = nodeIds.length ? `, CJK in ${nodeIds.length} element${nodeIds.length === 1 ? '' : 's'} via ${[...cjkFonts].join(', ')}` : '';
  console.log(`pdf: ${PAGE} → ${path.relative(ROOT, PDF)} (${pages} page${pages === 1 ? '' : 's'}, ${Math.round(pdf.length / 1024)} KB, ${links} links${cjk})`);
}

main().catch((err) => fail(err.stack || String(err)));
