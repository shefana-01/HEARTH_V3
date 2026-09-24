// Health-conditions and food catalogues exist twice: in the frontend (demo mode and labels) and in
// the backend's care-service (the real suggestions). This checks they are the same, so a food or a
// condition added on one side cannot be forgotten on the other.
//
//   node catalogue-parity.mjs            compare
//   node catalogue-parity.mjs --write    write the backend JSON files from the frontend's lists
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../..');
const resources = path.resolve(frontend, process.env.BACKEND_DIR ?? '../backend', 'care-service/src/main/resources');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hearth-catalogue-'));

async function load(entry, exportName) {
  const outfile = path.join(tmp, path.basename(entry) + '.mjs');
  await build({ entryPoints: [path.join(frontend, entry)], bundle: true, format: 'esm', outfile, logLevel: 'error', alias: { '@': path.join(frontend, 'src') } });
  return (await import(outfile))[exportName];
}

const catalogues = [
  { file: 'conditions.json', data: await load('src/constants/conditions.ts', 'HEALTH_CONDITIONS') },
  { file: 'foods.json', data: await load('src/mocks/foods.ts', 'foodOptions') },
];

let problems = 0;
for (const { file, data } of catalogues) {
  const target = path.join(resources, file);
  const wanted = JSON.stringify(data, null, 2) + '\n';
  if (process.argv.includes('--write')) {
    fs.writeFileSync(target, wanted);
    console.log(`wrote ${file} (${data.length} entries)`);
  } else if (!fs.existsSync(target)) {
    problems++;
    console.log(`MISSING ${target}`);
  } else if (JSON.stringify(JSON.parse(fs.readFileSync(target, 'utf8'))) !== JSON.stringify(data)) {
    problems++;
    console.log(`DIFFERENT ${file}: the backend copy does not match the frontend list. Run with --write.`);
  } else {
    console.log(`same ${file} (${data.length} entries)`);
  }
}
process.exit(problems ? 1 : 0);
