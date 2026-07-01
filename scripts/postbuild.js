import { existsSync, unlinkSync, createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const zipPath = resolve(root, 'calories.zip');
const sourceDir = resolve(root, 'calories');

if (existsSync(zipPath)) {
  unlinkSync(zipPath);
  console.log('Deleted existing calories.zip');
}

const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Created calories.zip (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(sourceDir, 'calories');
await archive.finalize();
