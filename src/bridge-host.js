import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const { startProxyServer } = await import(pathToFileURL(join(dirname(process.argv[2]), 'server.js')).href);
const instance = await startProxyServer({
  backend: 'antigravity', host: '127.0.0.1', port: Number(process.env.MERIDIAN_PORT),
  silent: true, idleTimeoutSeconds: 120,
  antigravity: { executable: process.env.MERIDIAN_AGY_PATH, allowUnverifiedWindows: true, allowToolBridge: true, allowNativeBrowser: false, allowNativeSubagents: false, pendingToolTimeoutMs: 300000 },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await instance.close(); process.exit(0); });
process.on('message', async message => { if (message === 'shutdown') { await instance.close(); process.exit(0); } });
process.on('disconnect', async () => { await instance.close(); process.exit(0); });
