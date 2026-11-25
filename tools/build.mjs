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
const css = readFileSync(join(root, 'src/library.css'), 'utf8') + '\n' + readFileSync(join(root, 'src/app-shell.css'), 'utf8');
const appJs = readFileSync(join(root, 'src/app-shell.js'), 'utf8');
if (/<\/script/i.test(js + appJs) || /<\/style/i.test(css)) throw new Error('source must not contain a closing script/style tag');

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
html = splice(html, '/*APP:BEGIN*/', '/*APP:END*/', '\n' + appJs + '\n', '(0,b.createRoot)(document.getElementById(`root`))', 'before');
html = splice(html, '/*LIB-CSS:BEGIN*/', '/*LIB-CSS:END*/', '\n' + css + '\n', '</style>', 'before');

// Link from the printables page to the library (one-time patch of the compiled code).
const intro = 'children:`מבחן חדש בכל לחיצה — שאלות אקראיות מכל הנושאים, עם דף תשובות נפרד.`})';
const withLink = 'children:`מבחן חדש בכל לחיצה — שאלות אקראיות מכל הנושאים, עם דף תשובות נפרד.`}),(0,U.jsx)(ae,{to:`/library`,className:`lib-link`,children:`עוד דפים לפי נושא ורמה: ספריית דפי העבודה ←`})';
if (!html.includes(withLink)) {
  if (html.split(intro).length !== 2) throw new Error('printables intro not found');
  html = html.replace(intro, withLink);
}

// Home page: the install / fullscreen control under the cards.
const homeOld = 'back:null,children:(0,U.jsx)(`div`,{className:`flex flex-col gap-3`,children:uh.map(';
const homeNew = 'back:null,children:(0,U.jsxs)(U.Fragment,{children:[(0,U.jsx)(`div`,{className:`flex flex-col gap-3`,children:uh.map(';
const homeEnd = '},e.to))})})}var fh=';
const homeEndNew = '},e.to))}),(0,U.jsx)(__app.InstallBar,{})]})})}var fh=';
if (!html.includes(homeNew)) {
  if (html.split(homeOld).length !== 2 || html.split(homeEnd).length !== 2) throw new Error('home page code not found');
  html = html.replace(homeOld, homeNew).replace(homeEnd, homeEndNew);
}

// <head>: manifest, icons and iOS home-screen tags (relative URLs: the site lives under a GitHub Pages subpath).
const headTags = [
  '<link rel="manifest" href="manifest.webmanifest" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png" />',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="חשבון ה׳" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
];
const anchorHead = '<meta name="theme-color" content="#FFF8EC" />';
if (!html.includes(headTags[0])) {
  if (html.split(anchorHead).length !== 2) throw new Error('theme-color meta not found');
  html = html.replace(anchorHead, anchorHead + '\n    ' + headTags.join('\n    '));
}

writeFileSync(file, html);
console.log(`index.html updated (${(html.length / 1024).toFixed(0)} KB)`);
