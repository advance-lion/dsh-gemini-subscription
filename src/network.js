// Keep proxying scoped to this plugin; never replace DSH's global dispatcher.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
let systemProxy;
async function windowsProxy() {
  if (process.platform !== 'win32') return undefined;
  const run = promisify(execFile);
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  try {
    const enabled = await run('reg.exe', ['query', key, '/v', 'ProxyEnable'], { windowsHide: true });
    if (!/REG_DWORD\s+0x1\b/.test(enabled.stdout)) return undefined;
    const result = await run('reg.exe', ['query', key, '/v', 'ProxyServer'], { windowsHide: true });
    const value = result.stdout.match(/REG_SZ\s+([^\r\n]+)/)?.[1].trim();
    const address = value?.includes('=') ? value.match(/(?:^|;)https=([^;]+)/)?.[1] : value;
    return address ? (/^https?:\/\//.test(address) ? address : `http://${address}`) : undefined;
  } catch { return undefined; }
}
export async function proxyAddress() {
  systemProxy ??= windowsProxy();
  return process.env.DSH_GEMINI_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || await systemProxy;
}
