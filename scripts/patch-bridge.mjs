import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const folder = resolve(process.argv[2] || '.bridge/node_modules/@rynfar/meridian');
const pkg = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
if (pkg.version !== '1.93.0') throw new Error('Expected Meridian 1.93.0; revalidate before changing dependency versions.');
let found = false;
for (const file of await readdir(join(folder, 'dist'))) {
  if (!file.endsWith('.js')) continue;
  const path = join(folder, 'dist', file), source = await readFile(path, 'utf8');
  if (source.includes('this.cliVersion !== "1.5.10"')) found = true;
  if (source.includes('this.cliVersion !== "1.2.7"')) {
    if (source.split('this.cliVersion !== "1.2.7"').length !== 2) throw new Error('Unexpected compatibility gate structure');
    await writeFile(path, source.replace('this.cliVersion !== "1.2.7"', 'this.cliVersion !== "1.5.10"'));
    found = true;
  }
}
if (!found) throw new Error('Compatibility gate not found');
console.log('Meridian 1.93.0 pinned to locally tested agy 1.5.10.');
