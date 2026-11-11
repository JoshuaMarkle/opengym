/**
 * A tiny headless-Chromium driver over the DevTools protocol (no Puppeteer).
 * Used by scripts/brand.ts (render icons) and scripts/screens.ts (capture the app).
 * Set CHROME=/path/to/chrome if it isn't on PATH as chromium / google-chrome.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function findChrome(): string {
  if (process.env.CHROME) return process.env.CHROME;
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      return execFileSync('which', [bin], { encoding: 'utf8' }).trim();
    } catch {
      /* try the next one */
    }
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return mac;
}

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

export class Browser {
  private ws!: WebSocket;
  private proc!: ChildProcess;
  private dir!: string;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners: ((m: any) => void)[] = [];

  /** `camera`: a .y4m / .mjpeg file the page's camera shows (getUserMedia is allowed without asking). */
  static async launch({ camera }: { camera?: string } = {}): Promise<Browser> {
    const b = new Browser();
    b.dir = mkdtempSync(join(tmpdir(), 'og-chrome-'));
    const media = camera ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${camera}`] : [];
    b.proc = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${b.dir}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', '--lang=en-US', ...media, 'about:blank'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const url = await new Promise<string>((resolve, reject) => {
      let buf = '';
      b.proc.stderr!.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) resolve(m[1]);
      });
      b.proc.on('exit', (code) => reject(new Error(`Chrome exited (${code}). Set CHROME=/path/to/chrome.\n${buf}`)));
    });
    b.ws = new WebSocket(url);
    await new Promise((r) => b.ws.addEventListener('open', r, { once: true }));
    b.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && b.pending.has(msg.id)) {
        const p = b.pending.get(msg.id)!;
        b.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${msg.error.message} ${msg.error.data ?? ''}`));
        else p.resolve(msg.result);
      } else b.listeners.forEach((l) => l(msg));
    });
    return b;
  }

  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(fn: (m: any) => void) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  async newPage(): Promise<Page> {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, sessionId);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    return page;
  }

  async close() {
    this.ws.close();
    this.proc.kill();
    await new Promise((r) => setTimeout(r, 200));
    rmSync(this.dir, { recursive: true, force: true });
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Page {
  private browser: Browser;
  private sessionId: string;

  constructor(browser: Browser, sessionId: string) {
    this.browser = browser;
    this.sessionId = sessionId;
    browser.on((m) => {
      if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') console.error('  page error:', m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    });
  }

  send(method: string, params: object = {}) {
    return this.browser.send(method, params, this.sessionId);
  }

  /** A phone-sized viewport (CSS px) with touch-style behavior. */
  async viewport(width: number, height: number, scale = 1, mobile = true) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  }

  async goto(url: string) {
    const loaded = new Promise<void>((resolve) => {
      const off = this.browser.on((m) => {
        if (m.sessionId === this.sessionId && m.method === 'Page.loadEventFired') {
          off();
          resolve();
        }
      });
    });
    await this.send('Page.navigate', { url });
    await loaded;
  }

  /** Run an expression (or an async function body via `(async () => …)()`) and return its JSON value. */
  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n${expression}`);
    return r.result.value as T;
  }

  async screenshot(path: string) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path, Buffer.from(data, 'base64'));
  }

  private mouse(type: string, x: number, y: number, buttons = 1) {
    return this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'mouse' });
  }

  async tap(x: number, y: number) {
    await this.mouse('mousePressed', x, y);
    await this.mouse('mouseReleased', x, y, 0);
  }

  /** Press and keep holding (for long-press menus); call release() after. */
  async press(x: number, y: number) {
    await this.mouse('mousePressed', x, y);
  }

  async moveTo(x: number, y: number, steps = 8, fromX = x, fromY = y) {
    for (let i = 1; i <= steps; i++) await this.mouse('mouseMoved', fromX + ((x - fromX) * i) / steps, fromY + ((y - fromY) * i) / steps);
  }

  async release(x: number, y: number) {
    await this.mouse('mouseReleased', x, y, 0);
  }

  /** Type into the focused field. */
  async type(text: string) {
    await this.send('Input.insertText', { text });
    await sleep(250);
  }

  /** Put a file into an <input type=file> (fires its change event). */
  async upload(selector: string, path: string) {
    const { root } = await this.send('DOM.getDocument');
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    await this.send('DOM.setFileInputFiles', { nodeId, files: [path] });
    await sleep(800);
  }

  /** Run a script in every new document before the page's own scripts. */
  async beforeLoad(source: string) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  /** Freeze "now" at a fixed moment; the clock still ticks from there. */
  async fixClock(at: Date) {
    await this.beforeLoad(`(() => { const D = Date, off = ${at.getTime()} - D.now();
      class FixedDate extends D { constructor(...a) { a.length ? super(...a) : super(D.now() + off); } static now() { return D.now() + off; } }
      globalThis.Date = FixedDate; })();`);
  }

  /**
   * Find a visible element and return its center, scrolling it into view first.
   * A string matches a control's aria-label or text: exact first, then prefix, then substring.
   * `{ sel, text?, nth?, start? }` matches a CSS selector (optionally containing, or with `start` starting with, text).
   * With several matches the last one wins (overlays render last), unless `nth` is given.
   */
  async find(target: Target, timeout = 6000): Promise<{ x: number; y: number; w: number; h: number }> {
    const until = Date.now() + timeout;
    for (;;) {
      const r = await this.findOnce(target);
      if (r) return r;
      if (Date.now() > until) throw new Error(`Not found: ${JSON.stringify(target)}`);
      await sleep(150);
    }
  }

  private async findOnce(target: Target) {
    const t = typeof target === 'string' ? { text: target } : target;
    return this.eval<{ x: number; y: number; w: number; h: number } | null>(`(() => {
      const t = ${JSON.stringify(t)};
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      let els;
      if (t.sel) els = [...document.querySelectorAll(t.sel)].filter((e) => !t.text || (t.start ? norm(e.textContent).startsWith(t.text) : norm(e.textContent).includes(t.text) || norm(e.getAttribute('aria-label')).includes(t.text)));
      else {
        const all = [...document.querySelectorAll('button,a,[role=button],[role=tab],[role=switch],label,input,textarea')].filter(vis);
        const label = (e) => norm(e.getAttribute('aria-label'));
        const text = (e) => norm(e.textContent || e.placeholder);
        for (const test of [(s) => s === t.text, (s) => s.startsWith(t.text), (s) => s.includes(t.text)]) {
          els = all.filter((e) => test(label(e)) || test(text(e)));
          if (els.length) break;
        }
      }
      els = els.filter(vis);
      const e = t.nth != null ? els[t.nth] : els[els.length - 1];
      if (!e) return null;
      e.scrollIntoView({ block: 'nearest' });
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
  }

  async click(target: Target, wait = 350) {
    const r = await this.find(target);
    await this.tap(r.x, r.y);
    await sleep(wait);
  }

  /** Long-press. `keep` leaves the pointer down (for capturing a press in progress). */
  async hold(target: Target, ms = 700, keep = false) {
    const r = await this.find(target);
    await this.press(r.x, r.y);
    await sleep(ms);
    if (!keep) await this.release(r.x, r.y);
    await sleep(300);
  }

  /** Drag horizontally from an element's center. `release: false` captures the swipe mid-way. */
  async swipe(target: Target, dx: number, release = true) {
    const r = await this.find(target);
    await this.press(r.x, r.y);
    await this.moveTo(r.x + dx, r.y, 12, r.x, r.y);
    if (release) await this.release(r.x + dx, r.y);
    await sleep(release ? 400 : 150);
  }

  /** Drag vertically by dy, then let go. */
  async drag(target: Target, dy: number, hold = 300) {
    const r = await this.find(target);
    await this.press(r.x, r.y);
    await sleep(hold);
    await this.moveTo(r.x, r.y + dy, 16, r.x, r.y);
    await sleep(200);
    await this.release(r.x, r.y + dy);
    await sleep(400);
  }
}

export type Target = string | { sel: string; text?: string; nth?: number; start?: boolean } | { text: string; nth?: number };
