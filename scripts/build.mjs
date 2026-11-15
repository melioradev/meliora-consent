// Builds the one-file install from src/: dist/meliora-consent.js (prelude + boot + strings + banner) and dist/meliora-consent.css.
// The boot part runs at once, so the stored choice and Consent Mode defaults apply before any tag; the banner waits until the page is parsed.
// Usage: node scripts/build.mjs           write dist/
//        node scripts/build.mjs --check   fail if dist/ is out of date with src/
import {readFile, writeFile, mkdir} from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const {version} = JSON.parse(await read('package.json'));
const [prelude, boot, i18n, menu, css] = await Promise.all([
  read('scripts/one-file-prelude.js'), read('src/meliora-consent-boot.js'), read('src/meliora-consent-i18n.js'),
  read('src/meliora-consent.js'), read('src/meliora-consent.css'),
]);

const header = `/*! Meliora Consent ${version} — https://github.com/melioradev/meliora-consent
    Made by Meliora Novotech Ltd (https://melioranovotech.com). License: MIT with visible attribution, see LICENSE.
    One-file build of src/ — don't edit; run \`node scripts/build.mjs\`. */\n`;
const js = `${header}${prelude}\n${boot}\n${i18n}\n(() => {\n  const start = () => {\n${menu}\n  };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();\n})();\n`;
const files = {'dist/meliora-consent.js': js, 'dist/meliora-consent.css': css};

if (process.argv.includes('--check')) {
  const stale = [];
  for (const [path, content] of Object.entries(files)) if (await read(path).catch(() => null) !== content) stale.push(path);
  if (stale.length) { console.error(`Out of date: ${stale.join(', ')}. Run node scripts/build.mjs`); process.exit(1); }
  console.log('dist/ is up to date');
} else {
  await mkdir(new URL('dist/', root), {recursive: true});
  for (const [path, content] of Object.entries(files)) await writeFile(new URL(path, root), content);
  console.log(`Built dist/ for ${version}`);
}
