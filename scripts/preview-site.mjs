import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// CDP_URL=http://127.0.0.1:9333 node scripts/preview-site.mjs
// Writes screenshots and browser-checks.json; an attached browser stays open.
if (process.argv.includes('--help')) {
  console.log('Usage: [CDP_URL=http://127.0.0.1:9333] node scripts/preview-site.mjs\n22 English/Chinese screenshots + browser-checks.json → ../preview/. Tests v1/v2/v3, language controls, and v2 at 1024, 1100, 1280, 1440, 1680 and 390 px.\nCDP_URL attaches to an existing browser; only script-owned targets are closed. Otherwise launches temporary Chrome.');
  process.exit(0);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '..', 'preview');
const work = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).selected_work;
const versions = ['v1', 'v2', 'v3'].flatMap((kind) => ['en', 'zh'].map((language) => ({
  kind, language, name: kind + (language === 'zh' ? '-zh' : ''), route: kind === 'v3' && language === 'zh' ? '/v3/zh/' : '/' + kind + '/',
})));
fs.mkdirSync(out, { recursive: true });
const external = process.env.CDP_URL;
let profile;
let chrome;
let socket;
let send;
const targets = new Set();

async function debuggerUrl() {
  if (external) {
    if (/^wss?:\/\//.test(external)) return external;
    const response = await fetch(new URL('/json/version', external), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('CDP endpoint returned HTTP ' + response.status);
    const version = await response.json();
    if (!version.webSocketDebuggerUrl) throw new Error('CDP endpoint has no webSocketDebuggerUrl');
    return version.webSocketDebuggerUrl;
  }
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-preview-chrome-'));
  const bin = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  chrome = spawn(bin, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000);
    let stderr = '';
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.on('error', (error) => { clearTimeout(timer); reject(error); });
    chrome.on('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code}, ${signal}): ${stderr.slice(-400)}`)); });
  });
}

async function afterNavigation(call, params) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    try { return await call('Runtime.evaluate', params); }
    catch (error) {
      if (!/Inspected target navigated|Execution context was destroyed|Cannot find.*context/.test(error.message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Navigation did not settle');
}

try {
  const url = await debuggerUrl();
  socket = new WebSocket(url);
  const pending = new Map();
  let seq = 0;
  const errors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 25000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const checks = [];
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000, mobile: false },
    { name: 'mobile', width: 390, height: 844, mobile: true },
    ...[[1024, 768], [1100, 800], [1280, 800], [1440, 800], [1680, 1000]].map(([width, height]) => ({ name: width + 'x' + height, width, height, mobile: false, v2Only: true }))]) {
    for (const version of versions) {
      if (viewport.v2Only && version.kind !== 'v2') continue;
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      targets.add(targetId);
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const call = (method, params) => send(method, params, sessionId);
      await call('Page.enable');
      await call('Runtime.enable');
      await call('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height,
        deviceScaleFactor: 1, mobile: viewport.mobile });
      await call('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile });
      await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await call('Page.navigate', { url: 'http://127.0.0.1:8765' + version.route });
      const result = await afterNavigation(call, {
        awaitPromise: true, returnByValue: true, timeout: 20000,
        expression: `new Promise((resolve, reject) => {
          const start = Date.now();
          const check = () => {
            const summaries = ${JSON.stringify(work.map((item) => version.kind === 'v3' && version.language === 'zh' ? item.zh.summary : item.summary))};
            const text = document.body?.innerText || '';
            if (summaries.every((summary) => text.includes(summary))) {
              document.fonts.ready.then(() => {
                window.scrollTo(0, 0);
                resolve({ url: location.href, title: document.title, width: innerWidth,
                  scrollWidth: document.documentElement.scrollWidth, summaries: summaries.length,
                  selectedWork: text.includes('selected work') || text.includes('SELECTED WORK') || text.includes('精选工作') });
              });
            } else if (Date.now() - start > 15000) reject(new Error('Selected Work did not render'));
            else setTimeout(check, 50);
          }; check();
        })`,
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      const state = result.result.value;
      if (version.language === 'zh' && version.kind === 'v1') {
        const command = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
          document.getElementById('cmd').value = 'work --zh';
          document.getElementById('line').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          return document.querySelector('#out .entry:last-child').innerText;
        })()` });
        if (!work.every((item) => command.result.value?.includes(item.zh.summary))) throw new Error('Chinese work command failed');
        state.chineseCommand = true;
      }
      if (version.language === 'zh' && version.kind === 'v2') {
        await call('Runtime.evaluate', { expression: `document.querySelector('[data-work-lang="zh"]').focus()` });
        await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        const chinese = await call('Runtime.evaluate', { returnByValue: true, expression: `({ text: document.getElementById('work').innerText, language: document.getElementById('work').lang, pressed: document.querySelector('[data-work-lang="zh"]').getAttribute('aria-pressed'), focused: document.activeElement?.outerHTML, pageFocus: document.hasFocus() })` });
        if (!work.every((item) => chinese.result.value?.text.includes(item.zh.summary)) || chinese.result.value.pressed !== 'true' || chinese.result.value.language !== 'zh-CN') throw new Error('Chinese panel keyboard toggle failed: ' + JSON.stringify(chinese.result.value));
        state.chineseToggle = true;
      }
      await call('Runtime.evaluate', { awaitPromise: true, expression: 'document.fonts.ready.then(() => window.scrollTo(0, 0))' });
      const overflow = await call('Runtime.evaluate', { returnByValue: true, expression: 'document.documentElement.scrollWidth > innerWidth + 1' });
      if (overflow.result.value) throw new Error(`${version.name} ${viewport.name}: horizontal overflow after language switch`);
      if (state.scrollWidth > state.width + 1) throw new Error(`${version.name} ${viewport.name}: horizontal overflow`);
      if (version.kind === 'v2') {
        const panels = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
          const problems = [], scrollable = [];
          const panels = [...document.querySelectorAll('.panel')].filter((el) => el.getBoundingClientRect().width);
          for (const panel of panels) {
            const content = panel.querySelector(':scope > .body');
            if (!content) continue;
            const p = panel.getBoundingClientRect(), c = content.getBoundingClientRect(), style = getComputedStyle(content);
            if (c.bottom > p.bottom + 1 || c.right > p.right + 1) problems.push(panel.id + ': body outside panel');
            if (content.scrollHeight > content.clientHeight + 1 && !/auto|scroll|hidden|clip/.test(style.overflowY)) problems.push(panel.id + ': visible vertical overflow');
            if (content.scrollWidth > content.clientWidth + 1 && !/auto|scroll|hidden|clip/.test(style.overflowX)) problems.push(panel.id + ': visible horizontal overflow');
            if (content.scrollHeight > content.clientHeight + 1 && /auto|scroll/.test(style.overflowY)) {
              const top = content.scrollTop;
              content.scrollTop = content.scrollHeight;
              if (content.scrollTop < 1) problems.push(panel.id + ': content cannot scroll');
              else scrollable.push(panel.id);
              content.scrollTop = top;
            }
          }
          for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
            const a = panels[i].getBoundingClientRect(), b = panels[j].getBoundingClientRect();
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) problems.push(panels[i].id + ' overlaps ' + panels[j].id);
          }
          if (getComputedStyle(document.body).overflowY === 'hidden' && document.getElementById('app').scrollHeight > innerHeight + 1) problems.push('app exceeds fixed viewport');
          return { count: panels.length, scrollable, problems };
        })()` });
        state.panels = panels.result.value;
      }
      const { cssContentSize } = await call('Page.getLayoutMetrics');
      const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: viewport.width, height: Math.max(viewport.height, cssContentSize.height), scale: 1 } });
      const name = `${version.name}-${viewport.name}.png`;
      fs.writeFileSync(path.join(out, name), Buffer.from(data, 'base64'));
      if (version.kind === 'v1') {
        const command = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
          document.getElementById('cmd').value = 'work';
          document.getElementById('line').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          return document.querySelector('#out .entry:last-child').innerText;
        })()` });
        if (!work.every((item) => command.result.value?.includes(item.title) && command.result.value.includes(item.summary))) throw new Error('work command failed');
        state.workCommand = true;
      }
      if (version.kind === 'v2') {
        const focus = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
          document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '8', bubbles: true }));
          return document.activeElement.id;
        })()` });
        if (focus.result.value !== 'p-work') throw new Error('Selected Work panel shortcut failed');
        state.panelShortcut = true;
        if (version.language === 'zh') {
          const english = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
            document.querySelector('[data-work-lang="en"]').click();
            return { text: document.getElementById('work').innerText, language: document.getElementById('work').lang };
          })()` });
          if (!work.every((item) => english.result.value.text.includes(item.summary)) || english.result.value.language !== 'en') throw new Error('English panel toggle failed');
          state.englishToggle = true;
        }
        if (!viewport.mobile) {
          await call('Runtime.evaluate', { expression: `window.__previewOpen = window.open; window.__previewOpened = []; window.open = (url) => { window.__previewOpened.push(url); return null; }; document.querySelector('#repos li.sel button').focus()` });
          await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
          await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
          const opened = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => { const urls = window.__previewOpened; window.open = window.__previewOpen; delete window.__previewOpen; delete window.__previewOpened; return urls; })()` });
          if (!opened.result.value?.some((url) => url.startsWith('https://github.com/szupzj18/'))) throw new Error('Repository Enter shortcut regressed');
          state.repoEnterShortcut = true;
        }
      }
      if (version.kind === 'v3') {
        const toc = await call('Runtime.evaluate', { returnByValue: true, expression: `!!document.querySelector('.toc a[href="#selected-work"]')` });
        if (!toc.result.value) throw new Error('Selected Work TOC entry missing');
        state.tocEntry = true;
        const language = await call('Runtime.evaluate', { returnByValue: true, expression: `({ language: document.documentElement.lang, alternate: !!document.querySelector('.languages a[href="${version.language === 'zh' ? '/v3/' : '/v3/zh/'}"]'), pdf: document.querySelector('.dl a').getAttribute('href'), sections: [...document.querySelectorAll('#man h2')].map((el) => el.textContent) })` });
        const locale = language.result.value;
        if (!locale.alternate || locale.language !== (version.language === 'zh' ? 'zh-CN' : 'en')) throw new Error('v3 language links or lang attribute missing');
        if (version.language === 'zh' && (!locale.sections.every((heading) => /[\u3400-\u9fff]/.test(heading)) || !locale.pdf.endsWith('chrispan-resume-zh.pdf'))) throw new Error('Chinese v3 sections or PDF link missing');
        state.locale = locale;
      }
      checks.push({ version: version.name, viewport, ...state, screenshot: name });
      console.log(name + ': 3 summaries, ' + (state.panels?.problems.length ? state.panels.problems.join('; ') : 'no overflow or panel overlap'));
      await send('Target.closeTarget', { targetId });
      targets.delete(targetId);
    }
  }
  fs.writeFileSync(path.join(out, 'browser-checks.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
  if (errors.length || checks.some((check) => check.panels?.problems.length)) throw new Error('FAIL: browser or panel checks; see preview/browser-checks.json');
  console.log('OK: ' + checks.length + ' screenshots and browser checks passed');
} finally {
  if (send && socket?.readyState === WebSocket.OPEN) {
    for (const targetId of targets) await send('Target.closeTarget', { targetId }).catch(() => {});
    if (!external) await send('Browser.close').catch(() => {});
  }
  socket?.close();
  chrome?.kill();
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
}
