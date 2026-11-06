// Renders the app icons in public/icons from SVG (run after changing the logo):
//
//   node tools/make-icons.mjs
//
// icon-*.png: the logo on white with rounded corners. maskable-*.png: full-bleed background with the logo
// inside the safe zone, for Android's adaptive icons. badge-96.png: one-colour silhouette for the status bar.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const dots = (scale, offset) =>
  [
    [11.5, 11.5, '#DB7D93'],
    [20.5, 11.5, '#F4C8D2'],
    [11.5, 20.5, '#6AB591'],
    [20.5, 20.5, '#6FA8CF'],
  ]
    .map(([x, y, c]) => `<circle cx="${offset + x * scale}" cy="${offset + y * scale}" r="${4 * scale}" fill="${c}"/>`)
    .join('');

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#FFFFFF"/>${dots(1, 0)}</svg>`;
// Safe zone is the centre 80%: scale the dots to 70% around the centre.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#F6F3EE"/>${dots(0.7, 4.8)}</svg>`;
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${[
  [11.5, 11.5],
  [20.5, 11.5],
  [11.5, 20.5],
  [20.5, 20.5],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#FFFFFF"/>`)
  .join('')}</svg>`;

const out = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (svg, size, name, transparent = false) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${out}${name}`, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
};
await render(icon, 192, 'icon-192.png', true);
await render(icon, 512, 'icon-512.png', true);
await render(maskable, 512, 'maskable-512.png');
await render(maskable, 180, 'apple-touch-icon.png');
await render(badge, 96, 'badge-96.png', true);
await browser.close();
console.log('icons written to public/icons');
