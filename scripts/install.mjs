import { readFile, writeFile, mkdir, copyFile, access, cp, unlink, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const dsh = process.env.DSH_HOME || join(homedir(), '.dsh');
const profile = join(dsh, 'profiles', 'desktop');
const stateDir = join(dsh, 'gemini-subscription');
const bridgeDir = join(stateDir, 'bridge');
const pnpm = join(dsh, 'dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs');
const run = args => { const r = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true }); if (r.status !== 0) throw new Error(`Installation command failed (${r.status})`); };
const exists = async p => access(p).then(() => true, () => false);
const manifest = join(profile, 'package.json');
if (!await exists(manifest)) throw new Error('Please open DSH Desktop once to initialize its profile.');
const backup = join(profile, '.gemini-subscription-backup', new Date().toISOString().replaceAll(':', '-'));
await mkdir(backup, { recursive: true });
for (const file of ['package.json', 'pnpm-lock.yaml', 'cordis.patch.yml']) if (await exists(join(profile, file))) await copyFile(join(profile, file), join(backup, file));
await mkdir(bridgeDir, { recursive: true });
await copyFile(join(root, 'bridge-package.json'), join(bridgeDir, 'package.json'));
if (!await exists(join(bridgeDir, 'node_modules/@rynfar/meridian/dist/cli.js'))) run([pnpm, '--dir', bridgeDir, 'install', '--ignore-scripts', ...(process.env.DSH_GEMINI_STORE_DIR ? ['--store-dir', process.env.DSH_GEMINI_STORE_DIR] : [])]);
run([join(root, 'scripts/patch-bridge.mjs'), join(bridgeDir, 'node_modules/@rynfar/meridian')]);
// Install a versioned tarball, not a dependency on the downloaded source folder.
const releaseDir = join(stateDir, 'packages');
await mkdir(releaseDir, { recursive: true });
run([pnpm, '--dir', root, 'pack', '--pack-destination', releaseDir]);
const ownPkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
run([pnpm, '--dir', profile, 'add', `file:${join(releaseDir, `${ownPkg.name}-${ownPkg.version}.tgz`).replaceAll('\\', '/')}`, '--offline', '--ignore-scripts']);
// pnpm caches file: packages with unchanged version. Refresh only this plugin's
// published files so repeated local development installs cannot load old code.
const installed = join(profile, 'node_modules/dsh-gemini-subscription');
if ((await realpath(root)).toLowerCase() !== (await realpath(installed)).toLowerCase()) {
  for (const dir of ['src', 'scripts']) await cp(join(root, dir), join(installed, dir), { recursive: true });
  for (const file of ['package.json', 'cordis.patch.yml', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'bridge-package.json', 'gemini.ps1', 'install.ps1']) await copyFile(join(root, file), join(installed, file));
}
for (const old of ['auth.js', 'protocol.js', 'code-assist.js']) await unlink(join(installed, 'src', old)).catch(e => { if (e.code !== 'ENOENT') throw e; });
await mkdir(stateDir, { recursive: true });
await writeFile(join(stateDir, 'bridge-location.json'), JSON.stringify({ bridgeCLI: join(bridgeDir, 'node_modules/@rynfar/meridian/dist/cli.js') }));
const pkg = JSON.parse(await readFile(manifest, 'utf8'));
const bundles = pkg.dsh.profile.bundles;
if (!bundles.includes('dsh-gemini-subscription')) bundles.push('dsh-gemini-subscription');
await writeFile(manifest, JSON.stringify(pkg, null, 2) + '\n');
// Profile config is an ordered patch list. An id merge preserves every other entry.
const patchPath = join(profile, 'cordis.patch.yml');
const patch = await readFile(patchPath, 'utf8');
const marker = '# dsh-gemini-subscription managed bridge location';
const configPatch = `\n${marker}\n- id: gemini-subscription\n  config:\n    bridgeCLI: ${JSON.stringify(join(bridgeDir, 'node_modules/@rynfar/meridian/dist/cli.js'))}\n`;
const managed = /\n# dsh-gemini-subscription managed bridge location\r?\n- id: gemini-subscription\r?\n  config:\r?\n    bridgeCLI: [^\r\n]+\r?\n?/;
await writeFile(patchPath, patch.replace(managed, '\n').trimEnd() + '\n' + configPatch);
console.log(`Installed. Restart DSH Desktop. Backup: ${backup}`);
