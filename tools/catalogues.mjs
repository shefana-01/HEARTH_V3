// Keeps care-service's reference data identical to the frontend's.
//
// The health-note list (frontend/src/constants/conditions.ts), the food list (frontend/src/mocks/foods.ts)
// and the tag labels (frontend/src/constants/labels.ts) are written once, in TypeScript. This script turns
// them into the JSON files care-service reads:
//
//   node tools/catalogues.mjs --write   regenerate the JSON after changing the TypeScript
//   node tools/catalogues.mjs --check   fail if they differ (run in CI)
//
// Needs the frontend's dependencies installed (it uses esbuild from frontend/node_modules).
import { build } from '../frontend/node_modules/esbuild/lib/main.js';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'frontend/src');
const target = join(root, 'backend/services/care-service/src/main/resources/catalogue');

const slash = (p) => p.replace(/\\/g, '/');

const entry = `
  export { HEALTH_CONDITIONS } from '${slash(join(src, 'constants/conditions.ts'))}';
  export { foodOptions } from '${slash(join(src, 'mocks/foods.ts'))}';
  export { NUTRITION_TAG_LABELS } from '${slash(join(src, 'constants/labels.ts'))}';
`;
const dir = mkdtempSync(join(tmpdir(), 'hearth-catalogue-'));
const out = join(dir, 'catalogue.mjs');
await build({
  stdin: { contents: entry, resolveDir: src, loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  alias: { '@': src },
  logLevel: 'silent',
});
const { HEALTH_CONDITIONS, foodOptions, NUTRITION_TAG_LABELS } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const files = {
  'conditions.json': HEALTH_CONDITIONS,
  'foods.json': foodOptions,
  'tag-labels.json': NUTRITION_TAG_LABELS,
};
const mode = process.argv[2];
let different = 0;
for (const [name, value] of Object.entries(files)) {
  const text = JSON.stringify(value, null, 2) + '\n';
  const path = join(target, name);
  if (mode === '--write') {
    writeFileSync(path, text);
    console.log(`wrote ${name} (${Array.isArray(value) ? value.length + ' entries' : Object.keys(value).length + ' keys'})`);
  } else if (!existsSync(path) || readFileSync(path, 'utf8').replace(/\r\n/g, '\n') !== text) {
    different++;
    console.log(`DIFFERENT: ${name} — run: node tools/catalogues.mjs --write`);
  }
}
if (mode !== '--write') {
  console.log(different ? `${different} catalogue file(s) out of date` : 'care-service catalogues match the frontend');
  process.exit(different ? 1 : 0);
}
