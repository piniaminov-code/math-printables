/* מסך מלא + הוספה למסך הבית (app shell). Injected into the bundle by tools/build.mjs.
 * Honest platform support:
 *  - Fullscreen: Fullscreen API where the browser allows it for pages (Chrome/Edge/Firefox/Android,
 *    iPad Safari). iPhone Safari does not support it for web pages, so the button is hidden there.
 *  - Install: Chrome/Edge/Android fire `beforeinstallprompt` -> real install prompt.
 *    iPhone/iPad have no prompt -> short instructions (Share -> "הוספה למסך הבית").
 *    Other browsers (Firefox desktop, Safari on Mac, ...) -> honest fallback text.
 *  - Hidden entirely when already running as an installed app, and never printed.
 * Also registers sw.js (shell-only offline cache), only over http(s).
 */
var __app = (() => {
  const h = (type, props, ...kids) => U.jsx(type, kids.length ? { ...props, children: kids.length === 1 ? kids[0] : kids } : props);
  const hs = (type, props, kids) => U.jsxs(type, { ...props, children: kids });

  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone|iPod/.test(ua);
  const isIOS = isIPhone || /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  // installed = opened from the home screen / app launcher (not a tab that entered fullscreen via the button)
  const isInstalled = () => navigator.standalone === true || mq('(display-mode: standalone)') || mq('(display-mode: minimal-ui)') || (mq('(display-mode: fullscreen)') && !fsElement());
  const canFullscreen = () => !isIPhone && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  let deferred = null;
  let installedNow = false;
  const subs = new Set();
  const ping = () => subs.forEach((f) => f());
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; ping(); });
  window.addEventListener('appinstalled', () => { deferred = null; installedNow = true; ping(); });
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, ping);
  if (window.matchMedia) for (const q of ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)']) { const m = window.matchMedia(q); m.addEventListener ? m.addEventListener('change', ping) : m.addListener && m.addListener(ping); }

  // service worker: shell-only cache (see sw.js). Not on file:// and not in unsupported browsers.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  const ShareIcon = () => hs('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': true, className: 'app-share-ico' }, [
    h('path', { d: 'M12 3v12M7.5 7.5 12 3l4.5 4.5', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    h('path', { d: 'M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  ]);

  function help() {
    if (isIOS)
      return { title: 'הוספה למסך הבית באייפון ובאייפד', steps: [
        ['בספארי, הקישו על כפתור השיתוף ', h(ShareIcon, {}), ' (בסרגל התחתון באייפון, או למעלה באייפד).'],
        ['גללו ובחרו "הוספה למסך הבית".'],
        ['הקישו "הוספה". האתר ייפתח מהמסך הבית כמו אפליקציה, בלי שורת כתובת.'],
      ], note: 'בדפדפנים אחרים באייפון (כמו כרום) האפשרות נמצאת גם היא בתפריט השיתוף. באייפון אין כפתור "מסך מלא" לדפי אינטרנט — אחרי ההוספה למסך הבית האתר נפתח על כל המסך.' };
    if (isAndroid)
      return { title: 'הוספה למסך הבית באנדרואיד', steps: [['פתחו את תפריט הדפדפן (שלוש הנקודות בפינה העליונה).'], ['בחרו "התקנת אפליקציה" או "הוספה למסך הבית".']], note: 'בכרום הכפתור כאן פותח את חלון ההתקנה ישירות, כשהדפדפן מאפשר זאת.' };
    return { title: 'התקנה במחשב', steps: [
      ['בכרום או באדג׳: סמל ההתקנה בצד שורת הכתובת, או בתפריט: "התקנת האתר כאפליקציה".'],
      ['בספארי במק (macOS 14 ומעלה): תפריט "קובץ" ← "הוספה ל־Dock".'],
    ], note: 'בפיירפוקס במחשב אין התקנה של אתרים — אפשר להוסיף סימנייה.' };
  }

  function InstallBar() {
    const [, force] = y.useState(0);
    const [sheet, setSheet] = y.useState(false);
    const [msg, setMsg] = y.useState('');
    y.useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
    if (installedNow || isInstalled()) return null;
    const fs = canFullscreen();
    const inFs = !!fsElement();
    const toggleFs = async () => {
      setMsg('');
      try {
        if (fsElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const el = document.documentElement; await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }); }
      } catch { setMsg('הדפדפן לא פתח מסך מלא. אפשר לנסות שוב, או להוסיף את האתר למסך הבית.'); }
    };
    const install = async () => {
      setMsg('');
      if (deferred) {
        const ev = deferred;
        deferred = null;
        try { await ev.prompt(); const c = await ev.userChoice; if (c && c.outcome === 'accepted') installedNow = true; } catch { setSheet(true); }
        force((n) => n + 1);
        return;
      }
      setSheet((v) => !v);
    };
    const info = help();
    return hs('section', { className: 'app-bar no-print', 'aria-label': 'שימוש כמו באפליקציה' }, [
      h('p', { className: 'app-bar-title' }, 'להשתמש כמו באפליקציה'),
      hs('div', { className: 'app-bar-btns' }, [
        fs ? h('button', { type: 'button', className: 'app-btn', onClick: toggleFs, 'aria-pressed': inFs }, inFs ? 'יציאה ממסך מלא' : 'מסך מלא') : null,
        h('button', { type: 'button', className: 'app-btn', onClick: install, 'aria-expanded': deferred ? undefined : sheet }, 'הוספה למסך הבית'),
      ]),
      sheet ? hs('div', { className: 'app-sheet', role: 'region', 'aria-label': info.title }, [
        h('p', { className: 'app-sheet-title' }, info.title),
        h('ol', { className: 'app-steps' }, ...info.steps.map((s, i) => U.jsx('li', { children: s }, i))),
        info.note ? h('p', { className: 'app-note' }, info.note) : null,
        h('button', { type: 'button', className: 'app-btn app-btn-quiet', onClick: () => setSheet(false) }, 'סגירה'),
      ]) : null,
      msg ? h('p', { className: 'app-note', role: 'status' }, msg) : null,
    ]);
  }

  // Keyboard control for the "בונות מלבן" board (it was pointer-only). The arrow keys grow and
  // shrink a rectangle anchored at the top-left square; the page's live line announces the size.
  // start/end/setStart/setEnd/setStatus are the game's own state, so checking works unchanged.
  const rectKey = (start, end, setStart, setEnd, setStatus) => (e) => {
    const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!dc && !dr) return;
    e.preventDefault();
    setStatus(null);
    if (!start || !end) { setStart({ r: 0, c: 0 }); setEnd({ r: 0, c: 0 }); return; }
    const cl = (v, hi) => Math.max(0, Math.min(hi, v));
    if (start.r !== 0 || start.c !== 0) setStart({ r: Math.min(start.r, end.r), c: Math.min(start.c, end.c) });
    setEnd({ r: cl(Math.max(start.r, end.r) + dr, Rr - 1), c: cl(Math.max(start.c, end.c) + dc, Lr - 1) });
  };

  return { InstallBar, isInstalled, canFullscreen, isIOS, isIPhone, rectKey };
})();
