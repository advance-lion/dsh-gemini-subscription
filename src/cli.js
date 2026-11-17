#!/usr/bin/env node
import { Bridge } from './bridge.js';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { proxyAddress } from './network.js';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
const saved = await readFile(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'gemini-subscription/bridge-location.json'), 'utf8').then(JSON.parse).catch(() => ({}));
const bridge = new Bridge({ bridgeCLI: process.env.DSH_GEMINI_BRIDGE_CLI || saved.bridgeCLI });
try {
  if (['login', 'quota'].includes(process.argv[2])) {
    const proxy = await proxyAddress();
    const args = process.argv[2] === 'quota' ? ['-p', '/usage', '--output-format', 'json'] : [];
    const child = spawn(join(process.env.LOCALAPPDATA, 'agy/bin/agy.exe'), args, { stdio: 'inherit', windowsHide: process.argv[2] !== 'login', env: { ...process.env, ...(proxy ? { HTTPS_PROXY: proxy, HTTP_PROXY: proxy } : {}) } });
    process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  } else {
    const path = process.argv[2] === 'smoke' ? '/v1/chat/completions' : '/v1/models';
    const init = process.argv[2] === 'smoke' ? { method: 'POST', body: JSON.stringify({ model: process.argv[3], messages: [{ role: 'user', content: 'Reply with exactly OK.' }], stream: false }) } : {};
    console.log(JSON.stringify(await (await bridge.request(path, init)).json(), null, 2));
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { bridge.stop(); }
