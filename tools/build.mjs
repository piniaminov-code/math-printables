// Injects src/library.js and src/library.css into index.html.
// index.html is a compiled bundle with no source in this repo; the library is kept as
// readable source and spliced into the bundle's module scope (between markers), so it
// can reuse the app's renderer, layout, PDF export and wording switch.
// Usage: node tools/build.mjs      (safe to run repeatedly; it replaces the old copy)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'index.html');
let html = readFileSync(file, 'utf8');
const js = readFileSync(join(root, 'src/library.js'), 'utf8');
const css = readFileSync(join(root, 'src/library.css'), 'utf8');
if (/<\/script/i.test(js) || /<\/style/i.test(css)) throw new Error('source must not contain a closing script/style tag');

function splice(text, begin, end, body, anchor, where) {
  const a = text.indexOf(begin);
  if (a >= 0) {
    const b = text.indexOf(end, a);
    if (b < 0) throw new Error(`unterminated marker ${begin}`);
    return text.slice(0, a) + begin + body + end + text.slice(b + end.length);
  }
  const i = text.indexOf(anchor);
  if (i < 0 || text.indexOf(anchor, i + 1) >= 0) throw new Error(`anchor not found exactly once: ${anchor.slice(0, 50)}`);
  const at = where === 'before' ? i : i + anchor.length;
  return text.slice(0, at) + begin + body + end + text.slice(at);
}

html = splice(html, '/*LIB:BEGIN*/', '/*LIB:END*/', '\n' + js + '\n', '(0,b.createRoot)(document.getElementById(`root`))', 'before');
html = splice(html, '/*LIB-CSS:BEGIN*/', '/*LIB-CSS:END*/', '\n' + css + '\n', '</style>', 'before');

// Link from the printables page to the library (one-time patch of the compiled code).
const intro = 'children:`מבחן חדש בכל לחיצה — שאלות אקראיות מכל הנושאים, עם דף תשובות נפרד.`})';
const withLink = 'children:`מבחן חדש בכל לחיצה — שאלות אקראיות מכל הנושאים, עם דף תשובות נפרד.`}),(0,U.jsx)(ae,{to:`/library`,className:`lib-link`,children:`עוד דפים לפי נושא ורמה: ספריית דפי העבודה ←`})';
if (!html.includes(withLink)) {
  if (html.split(intro).length !== 2) throw new Error('printables intro not found');
  html = html.replace(intro, withLink);
}

writeFileSync(file, html);
console.log(`index.html updated (${(html.length / 1024).toFixed(0)} KB)`);
