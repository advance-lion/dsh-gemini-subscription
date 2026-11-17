import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { proxyAddress } from './network.js';

export class Bridge {
  constructor(config = {}) { this.config = config; this.key = randomBytes(32).toString('hex'); this.stopped = false; }
  async start() {
    if (!this.starting) this.starting = this.launch().catch(e => { this.starting = null; throw e; });
    return this.starting;
  }
  async launch() {
    if (this.stopped) throw new Error('Gemini 桥接已停止');
    const cli = this.config.bridgeCLI || process.env.DSH_GEMINI_BRIDGE_CLI || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'gemini-subscription', 'bridge', 'node_modules', '@rynfar', 'meridian', 'dist', 'cli.js');
    const probe = createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    this.url = `http://127.0.0.1:${port}`;
    const agy = this.config.agyPath || process.env.DSH_GEMINI_AGY_PATH || join(process.env.LOCALAPPDATA || homedir(), 'agy', 'bin', 'agy.exe');
    const proxyURL = await proxyAddress();
    const child = this.child = spawn(process.execPath, [fileURLToPath(new URL('./bridge-host.js', import.meta.url)), cli], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: {
      ...process.env, MERIDIAN_BACKEND: 'antigravity', MERIDIAN_HOST: '127.0.0.1', MERIDIAN_PORT: String(port),
      ...(proxyURL ? { HTTPS_PROXY: proxyURL, HTTP_PROXY: proxyURL } : {}),
      NO_PROXY: 'localhost,127.0.0.1,::1',
      MERIDIAN_API_KEY: this.key, MERIDIAN_AGY_PATH: agy, MERIDIAN_AGY_ALLOW_TOOL_BRIDGE: '1',
      MERIDIAN_CONFIG_DIR: join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'gemini-subscription', 'meridian'),
    } });
    let failure;
    child.once('error', e => { failure = e; });
    child.stderr.on('data', () => {}); // Upstream logs can contain prompts; do not mirror them into DSH logs.
    child.once('exit', () => { if (this.child === child) { this.child = null; this.starting = null; } });
    for (let i = 0; i < 120; i++) {
      if (failure || child.exitCode !== null) throw new Error('Gemini 桥接服务启动失败，请运行 gemini.ps1 doctor 检查官方 CLI 登录。');
      if (this.stopped) { child.kill(); throw new Error('Gemini 桥接已停止'); }
      try { const r = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(500) }); if (r.ok) return; } catch {}
      await delay(500);
    }
    child.kill(); throw new Error('Gemini 桥接启动超时');
  }
  async request(path, init = {}) {
    if (!init.signal) await this.start();
    else {
      init.signal.throwIfAborted();
      let abort;
      const cancelled = new Promise((_, reject) => {
        abort = () => reject(init.signal.reason);
        init.signal.addEventListener('abort', abort, { once: true });
      });
      try { await Promise.race([this.start(), cancelled]); }
      finally { init.signal.removeEventListener('abort', abort); }
    }
    const res = await fetch(this.url + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const value = await res.json().catch(() => ({}));
      throw Object.assign(new Error(value.error?.message || `Gemini bridge HTTP ${res.status}`), { code: res.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR', status: res.status });
    }
    return res;
  }
  stop() {
    this.stopped = true;
    const child = this.child;
    if (!child) return;
    if (child.connected) child.send('shutdown');
    const timer = setTimeout(() => child.kill(), 5000); timer.unref();
    child.once('exit', () => clearTimeout(timer));
  }
}
