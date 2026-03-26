import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'frontend', 'dist');
const outDir = path.join(repoRoot, 'build');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(distDir))) {
  console.error(`Missing ${distDir}. Run "npm run build" first.`);
  process.exit(1);
}

await fs.rm(outDir, {recursive: true, force: true});
await fs.mkdir(outDir, {recursive: true});
await fs.cp(distDir, outDir, {recursive: true});

console.log(`Prepared deploy folder: ${outDir}`);

