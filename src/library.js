/* ספריית דפי עבודה — worksheet library.
 *
 * Readable source. tools/build.mjs injects this file into the module scope of
 * the compiled bundle in index.html (just before the app is rendered), so it can
 * use the bundle's internals by their minified names:
 *   React: y (hooks), U (jsx runtime)          rng: k(seed), A(r,lo,hi), j(r,arr), M(r,arr)
 *   math tokens: C num, w frac, T mixed, E op, D blank, P(...toks) -> {math}
 *   layout: ye page, xe primary button, Se secondary button, ae link, W navigate,
 *           ce() search params, se() route params, N() random seed, x gcd
 *   rendering: Ue one math token, eh blank fraction, Qr fraction shapes svg
 *   exam engine: wsBuild, li, mpgAdaptExam, oh (paper), ch (answer key), B topics
 *   wording: mpgGet, mpgSet, mpgStr, mpgPairs; pdf: Ci, Gm, Om; home cards: uh;
 *   router: ee (routes), fh (route -> component)
 * Everything new lives inside this IIFE; only `__lib` is added to module scope.
 */
var __lib = (() => {
  const h = (type, props, ...kids) =>
    U.jsx(type, kids.length ? { ...props, children: kids.length === 1 ? kids[0] : kids } : props);
  const hs = (type, props, kids) => U.jsxs(type, { ...props, children: kids });

  // ---------- math helpers ----------
  const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const ri = (r, lo, hi) => A(r, Math.ceil(lo), Math.floor(hi));
  const pick = (r, arr) => j(r, arr);
  const shuffle = (r, arr) => M(r, arr);
  const coprime = (r, d, lo = 1, hi = d - 1) => {
    const c = [];
    for (let i = lo; i <= hi; i++) if (gcd(i, d) === 1) c.push(i);
    return pick(r, c);
  };
  const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // exact decimals as integers scaled by 1000 (thousandths), printed without trailing zeros
  const decStr = (m, minPlaces = 0) => {
    const neg = m < 0;
    m = Math.abs(m);
    const ip = Math.floor(m / 1000);
    let fp = String(m % 1000).padStart(3, '0').replace(/0+$/, '');
    while (fp.length < minPlaces) fp += '0';
    return (neg ? '-' : '') + fmtInt(ip) + (fp ? '.' + fp : '');
  };
  const n2 = (v) => C(v); // number token (number or preformatted string)
  const fr = (n, d) => w(n, d);
  const mx = (wh, n, d) => T(wh, n, d);
  const op = (v) => E(v);
  const BL = D; // small blank box
  const WB = { t: 'wb' }; // wide blank (for multi-digit / decimal answers)
  const FB = (n = null, d = null) => ({ t: 'fb', n, d }); // fraction with blank part(s)
  const MB = { t: 'mb' }; // mixed-number blank (whole box + fraction boxes)
  const M_ = (...t) => P(...t);
  // value of a fraction n/d as the friendliest token: whole, proper fraction or mixed number
  const ratTok = (n, d) => {
    const g = gcd(n, d);
    (n /= g), (d /= g);
    if (d === 1) return n2(n);
    if (n > d) return mx(Math.floor(n / d), n % d, d);
    return fr(n, d);
  };
  const simp = (n, d) => {
    const g = gcd(n, d);
    return [n / g, d / g];
  };

  const sr_ = ['דנה', 'יעל', 'מאיה', 'נוי', 'תמר', 'שירה', 'נעמה', 'ליה'];
  const cr_ = ['עומר', 'איתי', 'גיא', 'רון', 'יואב', 'נועם', 'אלון', 'דניאל'];

  // ---------- generators ----------
  // Each returns an item: { gen, fmt, ... , answer, key }.
  //  fmt 'expr'   : expr tokens with blanks
  //  fmt 'choice' : prompt/expr/visual + options (rich[]), answer.correct
  //  fmt 'tf'     : statement (tokens), answer.value boolean
  //  fmt 'order'  : values (tokens) to order ascending, answer.order (indices)
  //  fmt 'match'  : left[], right[] (tokens), answer.map[i] = right index
  //  fmt 'table'  : cols (strings), rows [{label:tokens}], answer.cells[r][c] boolean / answer.choice[r]
  //  fmt 'vertical': rows (strings), op, answer.v
  //  fmt 'word'   : prompt rich, answer line
  const GEN = {};

  // ---- equivalent fractions ----
  GEN.eqExpand = (r, L) => {
    const d = pick(r, [[2, 3, 4, 5], [2, 3, 4, 5, 6, 8], [3, 4, 5, 6, 7, 8, 9, 10, 12]][L - 1]);
    const n = coprime(r, d);
    const k = L === 1 ? ri(r, 2, 3) : L === 2 ? ri(r, 2, 5) : ri(r, 3, 9);
    const v = L === 1 ? 0 : L === 2 ? ri(r, 0, 1) : ri(r, 0, 3);
    let expr, ans;
    if (v === 0) (expr = [fr(n, d), op('='), FB(null, d * k)]), (ans = n * k);
    else if (v === 1) (expr = [fr(n, d), op('='), FB(n * k, null)]), (ans = d * k);
    else if (v === 2) (expr = [fr(n * k, d * k), op('='), FB(null, d)]), (ans = n);
    else (expr = [fr(n * k, d * k), op('='), FB(n, null)]), (ans = d);
    return { gen: 'eqExpand', fmt: 'expr', expr, answer: { kind: 'num', v: ans }, key: [M_(...expr.map((t) => (t.t === 'fb' ? fr(t.n ?? ans, t.d ?? ans) : t)))] };
  };
  GEN.eqSimplify = (r, L) => {
    const d = pick(r, [[2, 3, 4, 5, 6], [3, 4, 5, 6, 7, 8, 9, 10], [5, 6, 7, 8, 9, 10, 11, 12]][L - 1]);
    const n = coprime(r, d);
    const k = L === 1 ? ri(r, 2, 3) : L === 2 ? ri(r, 2, 6) : ri(r, 4, 12);
    return { gen: 'eqSimplify', fmt: 'expr', expr: [fr(n * k, d * k), op('='), FB()], answer: { kind: 'frac', n, d, lowest: true }, key: [M_(fr(n * k, d * k), op('='), fr(n, d))] };
  };
  GEN.eqTF = (r, L) => {
    const d = pick(r, L === 1 ? [2, 3, 4, 5] : [3, 4, 5, 6, 7, 8]);
    const n = coprime(r, d);
    const k = ri(r, 2, L === 3 ? 7 : 4);
    const truth = r() < 0.5;
    let a, b, why;
    if (truth) (a = n * k), (b = d * k);
    else {
      const v = ri(r, 0, 2);
      if (v === 0) (a = n + k), (b = d + k), (why = 'הוסיפו מספר למונה ולמכנה — זה משנה את השבר.');
      else if (v === 1) (a = n * k), (b = d * k + 1), (why = null);
      else (a = n * k), (b = d), (why = 'הכפילו רק את המונה.');
      if (a * d === n * b) (a = n * k), (b = d * k + 1);
    }
    const st = [fr(n, d), op('='), fr(a, b)];
    return { gen: 'eqTF', fmt: 'tf', statement: [M_(...st)], answer: { value: a * d === n * b }, key: a * d === n * b ? ['נכון'] : ['לא נכון: ', M_(fr(n, d), op('='), fr(n * k, d * k))] };
  };
  GEN.eqOdd = (r, L) => {
    const d = pick(r, [[2, 3, 4], [3, 4, 5, 6], [4, 5, 6, 7, 8]][L - 1]);
    const n = coprime(r, d);
    const ks = shuffle(r, [2, 3, 4, 5, 6]).slice(0, 3);
    let bad = [n + ks[0], d + ks[0]];
    if (L >= 2 && r() < 0.5) bad = [n * ks[1], d * ks[1] + 1];
    const opts = shuffle(r, [...ks.map((kk) => [n * kk, d * kk]), bad]);
    const correct = opts.findIndex((o) => o === bad);
    return { gen: 'eqOdd', fmt: 'choice', prompt: ['הקיפי את השבר שאינו שווה ל־', M_(fr(n, d)), ':'], options: opts.map(([a, b]) => [M_(fr(a, b))]), answer: { correct, base: [n, d], opts }, key: [M_(fr(bad[0], bad[1]))] };
  };
  GEN.eqMatch = (r, L) => {
    const cnt = L === 1 ? 4 : 5;
    const pool = [];
    for (const d of [2, 3, 4, 5, 6, 7, 8, 9, 10]) for (let n = 1; n < d; n++) if (gcd(n, d) === 1) pool.push([n, d]);
    const left = [];
    for (const f of shuffle(r, pool)) {
      if (left.length === cnt) break;
      if (L === 1 && f[1] > 6) continue;
      left.push(f);
    }
    const right = left.map(([n, d]) => {
      const kk = ri(r, 2, L === 3 ? 8 : 4);
      return [n * kk, d * kk];
    });
    // a derangement: no fraction sits on the same row as its partner
    let order;
    do order = shuffle(r, right.map((_, i) => i));
    while (order.some((v, i) => v === i));
    const rightShown = order.map((i) => right[i]);
    const map = left.map((_, i) => order.indexOf(i));
    return { gen: 'eqMatch', fmt: 'match', left: left.map(([a, b]) => [fr(a, b)]), right: rightShown.map(([a, b]) => [fr(a, b)]), answer: { map }, key: [map.map((m, i) => `${'אבגדהו'[i]}–${m + 1}`).join('   ')] };
  };

  // ---- compare with different denominators ----
  const symOf = (a, b) => (a < b ? '<' : a > b ? '>' : '=');
  const fracVal = (t) => (t.t === 'num' ? Number(t.v) : t.t === 'frac' ? t.n / t.d : t.w + t.n / t.d);
  // exact comparison (no floating point): value as integer pair [numerator, denominator]
  const ratOf = (t) => (t.t === 'num' ? [Number(t.v), 1] : t.t === 'frac' ? [t.n, t.d] : [t.w * t.d + t.n, t.d]);
  const cmpExact = (a, b) => { const [p, q] = ratOf(a), [u, v] = ratOf(b); return Math.sign(p * v - u * q); };
  GEN.cmpDiff = (r, L) => {
    let a, b;
    if (L === 1) {
      const d1 = pick(r, [2, 3, 4, 5]), m = pick(r, [2, 3]), d2 = d1 * m;
      a = fr(coprime(r, d1), d1);
      b = fr(ri(r, 1, d2 - 1), d2);
    } else if (L === 2) {
      const [d1, d2] = pick(r, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [4, 6], [3, 8], [5, 6], [6, 8], [4, 10]]);
      a = fr(ri(r, 1, d1 - 1), d1);
      b = fr(ri(r, 1, d2 - 1), d2);
      if (r() < 0.2) { const kk = d2 / gcd(d1, d2); const nn = ri(r, 1, d1 - 1); a = fr(nn, d1); b = fr(nn * (lcm(d1, d2) / d1), lcm(d1, d2)); }
    } else {
      const [d1, d2] = pick(r, [[3, 4], [4, 6], [5, 10], [3, 5], [6, 9], [8, 12], [5, 8]]);
      const wh = ri(r, 1, 4);
      a = mx(wh, ri(r, 1, d1 - 1), d1);
      b = r() < 0.5 ? mx(wh, ri(r, 1, d2 - 1), d2) : fr(wh * d2 + ri(r, 1, d2 - 1), d2);
    }
    if (r() < 0.5) [a, b] = [b, a];
    const s = symOf(cmpExact(a, b), 0);
    return { gen: 'cmpDiff', fmt: 'expr', expr: [a, BL, b], answer: { kind: 'sym', v: s }, key: [M_(a, op(s), b)] };
  };
  GEN.orderDiff = (r, L) => {
    const dens = [[2, 4, 8], [2, 3, 4, 6, 12], [3, 4, 5, 6, 8, 10, 12]][L - 1];
    const vals = [];
    let guard = 0;
    while (vals.length < 4 && guard++ < 200) {
      const d = pick(r, dens);
      const n = L === 3 && r() < 0.3 ? ri(r, d + 1, 2 * d - 1) : ri(r, 1, d - 1);
      if (vals.some(([a, b]) => a * d === n * b)) continue;
      vals.push([n, d]);
    }
    const toks = vals.map(([n, d]) => (n > d && r() < 0.5 ? mx(Math.floor(n / d), n % d, d) : fr(n, d)));
    const order = toks.map((_, i) => i).sort((i, k2) => cmpExact(toks[i], toks[k2]));
    return { gen: 'orderDiff', fmt: 'order', values: toks, answer: { order }, key: [M_(...order.flatMap((i, z) => (z ? [op('<'), toks[i]] : [toks[i]])))] };
  };
  GEN.halfTable = (r, L) => {
    const rows = [];
    const dens = L === 1 ? [2, 4, 6, 8, 10] : L === 2 ? [3, 4, 5, 6, 7, 8, 9, 10, 12] : [5, 7, 9, 11, 12, 14, 15, 16, 20];
    let eq = false, guard = 0;
    while (rows.length < 5 && guard++ < 300) {
      const d = pick(r, dens);
      let n = ri(r, 1, d - 1);
      if (!eq && d % 2 === 0 && rows.length === 2) n = d / 2;
      if (rows.some(([a, b]) => a * d === n * b)) continue;
      if (2 * n === d) eq = true;
      rows.push([n, d]);
    }
    return { gen: 'halfTable', fmt: 'table', cols: ['קטן מ־½', 'שווה ל־½', 'גדול מ־½'], rows: rows.map(([n, d]) => [fr(n, d)]), answer: { choice: rows.map(([n, d]) => (2 * n < d ? 0 : 2 * n === d ? 1 : 2)) }, key: rows.map(([n, d], i) => [i ? '   ' : '', M_(fr(n, d), op(2 * n < d ? '<' : 2 * n === d ? '=' : '>'), fr(1, 2))]).flat() };
  };

  // ---- add / subtract with different denominators ----
  const pairDen = (r, L) =>
    L === 1
      ? (() => { const d1 = pick(r, [2, 3, 4, 5]); return [d1, d1 * pick(r, d1 <= 3 ? [2, 3, 4] : [2])]; })()
      : pick(r, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 6], [6, 8], [4, 5], [2, 7], [3, 9], [5, 10], [4, 10], [6, 9]]);
  const addKey = (expr, n, d) => {
    const [a, b] = simp(n, d);
    return [M_(...expr.slice(0, -1), ratTok(a, b))];
  };
  GEN.addDiff = (r, L) => {
    let [d1, d2] = pairDen(r, L);
    if (r() < 0.5) [d1, d2] = [d2, d1];
    let a = ri(r, 1, d1 - 1), b = ri(r, 1, d2 - 1);
    if (L === 1) { let guard = 0; while (a * d2 + b * d1 > d1 * d2 && guard++ < 50) (a = ri(r, 1, d1 - 1)), (b = ri(r, 1, d2 - 1)); }
    let w1 = 0, w2 = 0;
    if (L === 3) (w1 = ri(r, 1, 4)), (w2 = ri(r, 1, 3));
    const t1 = w1 ? mx(w1, a, d1) : fr(a, d1), t2 = w2 ? mx(w2, b, d2) : fr(b, d2);
    const D_ = lcm(d1, d2), N_ = (w1 * d1 + a) * (D_ / d1) + (w2 * d2 + b) * (D_ / d2);
    const expr = [t1, op('+'), t2, op('='), L === 1 ? FB() : MB];
    return { gen: 'addDiff', fmt: 'expr', expr, answer: { kind: 'rat', n: N_, d: D_ }, key: addKey(expr, N_, D_) };
  };
  GEN.subDiff = (r, L) => {
    let guard = 0;
    for (;;) {
      let [d1, d2] = pairDen(r, L);
      if (r() < 0.5) [d1, d2] = [d2, d1];
      const a = ri(r, 1, d1 - 1), b = ri(r, 1, d2 - 1);
      const w1 = L === 3 ? ri(r, 2, 5) : 0, w2 = L === 3 ? ri(r, 0, w1 - 1) : 0;
      const D_ = lcm(d1, d2), N_ = (w1 * d1 + a) * (D_ / d1) - (w2 * d2 + b) * (D_ / d2);
      if (N_ <= 0 && guard++ < 100) continue;
      const t1 = w1 ? mx(w1, a, d1) : fr(a, d1), t2 = w2 ? mx(w2, b, d2) : fr(b, d2);
      const expr = [t1, op('-'), t2, op('='), L === 1 ? FB() : MB];
      return { gen: 'subDiff', fmt: 'expr', expr, answer: { kind: 'rat', n: N_, d: D_ }, key: addKey(expr, N_, D_) };
    }
  };
  GEN.toWhole = (r, L) => {
    const d1 = pick(r, [2, 3, 4, 5]), d2 = d1 * pick(r, L === 1 ? [2] : [2, 3]);
    const a = ri(r, 1, d1 - 1);
    const ans = d2 - a * (d2 / d1);
    const expr = [fr(a, d1), op('+'), FB(null, d2), op('='), n2(1)];
    return { gen: 'toWhole', fmt: 'expr', expr, answer: { kind: 'num', v: ans }, key: [M_(fr(a, d1), op('+'), fr(ans, d2), op('='), n2(1))] };
  };
  GEN.wordDiff = (r, L) => {
    const f = pick(r, sr_), m = pick(r, cr_);
    let guard = 0;
    for (;;) {
      const [d1, d2] = pairDen(r, Math.min(L, 2));
      const a = ri(r, 1, d1 - 1), b = ri(r, 1, d2 - 1);
      const D_ = lcm(d1, d2), A_ = a * (D_ / d1), B_ = b * (D_ / d2);
      const kind = pick(r, L === 1 ? ['together', 'left'] : ['together', 'left', 'more']);
      if ((kind === 'together' || kind === 'left') && A_ + B_ >= D_ && guard++ < 100) continue;
      if (kind === 'more' && A_ <= B_ && guard++ < 100) continue;
      let prompt, N_;
      if (kind === 'together') (prompt = [`${f} אכלה `, M_(fr(a, d1)), ` מהעוגה ו${m} אכל `, M_(fr(b, d2)), ` מאותה עוגה. איזה חלק מהעוגה אכלו יחד?`]), (N_ = A_ + B_);
      else if (kind === 'left') (prompt = [`${f} אכלה `, M_(fr(a, d1)), ` מהעוגה ו${m} אכל `, M_(fr(b, d2)), ` מאותה עוגה. איזה חלק מהעוגה נשאר?`]), (N_ = D_ - A_ - B_);
      else (prompt = [`${f} הלכה `, M_(fr(a, d1)), ` ק״מ ו${m} הלך `, M_(fr(b, d2)), ` ק״מ. בכמה ק״מ הלכה ${f} יותר מ${m}?`]), (N_ = A_ - B_);
      const [sn, sd] = simp(N_, D_);
      return { gen: 'wordDiff', fmt: 'word', prompt, answer: { kind: 'rat', n: N_, d: D_, wk: kind }, key: [M_(ratTok(sn, sd))] };
    }
  };

  // ---- fraction × whole number ----
  GEN.fracTimes = (r, L) => {
    const nn = L === 1 ? ri(r, 2, 4) : ri(r, 2, 9);
    const d = pick(r, L === 1 ? [3, 4, 5, 6, 8, 10] : [3, 4, 5, 6, 7, 8, 9, 10, 12]);
    const a = ri(r, 1, d - 1);
    const wh = L === 3 ? ri(r, 1, 3) : 0;
    const t = wh ? mx(wh, a, d) : fr(a, d);
    const N_ = nn * (wh * d + a);
    const expr = r() < 0.5 ? [n2(nn), op('*'), t, op('='), MB] : [t, op('*'), n2(nn), op('='), MB];
    const [sn, sd] = simp(N_, d);
    return { gen: 'fracTimes', fmt: 'expr', expr, answer: { kind: 'rat', n: N_, d }, key: [M_(...expr.slice(0, -1), ...(N_ > d && sd !== 1 ? [fr(N_, d), op('=')] : []), ratTok(sn, sd))] };
  };
  GEN.repeatedAdd = (r, L) => {
    const cnt = ri(r, 3, L === 1 ? 4 : 6), d = pick(r, [3, 4, 5, 6, 7, 8, 9, 10]), a = ri(r, 1, d - 1);
    const sum = Array.from({ length: cnt }, (_, i) => (i ? [op('+'), fr(a, d)] : [fr(a, d)])).flat();
    const expr = [...sum, op('='), BL, op('*'), fr(a, d), op('='), MB];
    const [sn, sd] = simp(cnt * a, d);
    return { gen: 'repeatedAdd', fmt: 'expr', expr, answer: { kind: 'multi', vals: [{ kind: 'num', v: cnt }, { kind: 'rat', n: cnt * a, d }] }, key: [M_(...sum, op('='), n2(cnt), op('*'), fr(a, d), op('='), ratTok(sn, sd))] };
  };
  GEN.mulWord = (r, L) => {
    const d = pick(r, [2, 3, 4, 5, 8, 10]), a = ri(r, 1, d - 1), nn = ri(r, 2, L === 1 ? 5 : 12);
    const t = pick(r, [
      [`בכל בקבוק יש `, ` ליטר מיץ. כמה ליטר מיץ יש ב־${nn} בקבוקים?`],
      [`כל יום ${pick(r, sr_)} רצה `, ` ק״מ. כמה קילומטרים רצה ב־${nn} ימים?`],
      [`לכל עוגה צריך `, ` כוס סוכר. כמה כוסות סוכר צריך ל־${nn} עוגות?`],
      [`כל פרוסה היא `, ` מפיצה. כמה פיצות הן ${nn} פרוסות כאלה?`],
    ]);
    const [sn, sd] = simp(nn * a, d);
    return { gen: 'mulWord', fmt: 'word', prompt: [t[0], M_(fr(a, d)), t[1]], answer: { kind: 'rat', n: nn * a, d, nn, f: [a, d] }, key: [M_(n2(nn), op('*'), fr(a, d), op('='), ratTok(sn, sd))] };
  };

  // ---- decimals (values held as integers in thousandths) ----
  GEN.decFrac = (r, L) => {
    const v = ri(r, 0, 1);
    if (L === 1) {
      const n = ri(r, 1, 9), wh = r() < 0.4 ? ri(r, 1, 9) : 0;
      if (v === 0) {
        const expr = [wh ? mx(wh, n, 10) : fr(n, 10), op('='), WB];
        return { gen: 'decFrac', fmt: 'expr', expr, answer: { kind: 'dec', m: wh * 1000 + n * 100 }, key: [M_(expr[0], op('='), n2(decStr(wh * 1000 + n * 100)))] };
      }
      return { gen: 'decFrac', fmt: 'expr', expr: [n2(decStr(n * 100)), op('='), FB(null, 10)], answer: { kind: 'num', v: n }, key: [M_(n2(decStr(n * 100)), op('='), fr(n, 10))] };
    }
    if (L === 2) {
      const n = r() < 0.3 ? ri(r, 1, 9) : ri(r, 11, 99);
      if (v === 0) {
        const expr = [fr(n, 100), op('='), WB];
        return { gen: 'decFrac', fmt: 'expr', expr, answer: { kind: 'dec', m: n * 10 }, key: [M_(fr(n, 100), op('='), n2(decStr(n * 10)))] };
      }
      return { gen: 'decFrac', fmt: 'expr', expr: [n2(decStr(n * 10)), op('='), FB(null, 100)], answer: { kind: 'num', v: n }, key: [M_(n2(decStr(n * 10)), op('='), fr(n, 100))] };
    }
    const den = pick(r, [10, 100, 1000]), n = den === 10 ? ri(r, 1, 9) : den === 100 ? pick(r, [ri(r, 1, 9), ri(r, 10, 99)]) : pick(r, [ri(r, 1, 9), ri(r, 10, 99), ri(r, 101, 999)]);
    const wh = ri(r, 1, 12);
    const m = wh * 1000 + n * (1000 / den);
    if (v === 0) {
      const expr = [mx(wh, n, den), op('='), WB];
      return { gen: 'decFrac', fmt: 'expr', expr, answer: { kind: 'dec', m }, key: [M_(expr[0], op('='), n2(decStr(m)))] };
    }
    return { gen: 'decFrac', fmt: 'expr', expr: [n2(decStr(m)), op('='), MB], answer: { kind: 'rat', n: m, d: 1000 }, key: [M_(n2(decStr(m)), op('='), mx(wh, n, den))] };
  };
  const randDec = (r, places, maxWhole) => {
    const wh = ri(r, 0, maxWhole);
    const f = places === 1 ? ri(r, 0, 9) * 100 : places === 2 ? ri(r, 0, 99) * 10 : ri(r, 0, 999);
    return wh * 1000 + f;
  };
  const placesOf = (m) => (m % 1000 === 0 ? 0 : m % 100 === 0 ? 1 : m % 10 === 0 ? 2 : 3);
  GEN.decCompare = (r, L) => {
    let a, b, sa, sb;
    if (L === 1) (a = randDec(r, 1, 3)), (b = randDec(r, 1, 3));
    else if (L === 2) {
      const v = ri(r, 0, 2);
      const wh = ri(r, 0, 5) * 1000;
      if (v === 0) (a = wh + ri(r, 1, 9) * 100), (b = wh + ri(r, 10, 99) * 10);
      else if (v === 1) (a = wh + ri(r, 1, 9) * 100), (b = a);
      else (a = randDec(r, 2, 5)), (b = randDec(r, 1, 5));
    } else {
      const wh = ri(r, 0, 9) * 1000;
      a = wh + ri(r, 1, 999);
      b = r() < 0.3 ? wh + 1000 : wh + ri(r, 1, 99) * 10;
    }
    sa = decStr(a, a === b && L === 2 ? 1 : 0);
    sb = decStr(b, a === b && L === 2 ? 2 : 0);
    if (r() < 0.5) ([a, b] = [b, a]), ([sa, sb] = [sb, sa]);
    const s = symOf(a, b);
    return { gen: 'decCompare', fmt: 'expr', expr: [n2(sa), BL, n2(sb)], answer: { kind: 'sym', v: s }, key: [M_(n2(sa), op(s), n2(sb))] };
  };
  GEN.decOrder = (r, L) => {
    const vals = new Set();
    const base = ri(r, 0, L === 3 ? 9 : 3) * 1000;
    let guard = 0;
    while (vals.size < 4 && guard++ < 200) {
      const p = L === 1 ? 1 : pick(r, L === 2 ? [1, 2] : [1, 2, 3]);
      const wh = L === 1 ? ri(r, 0, 3) * 1000 : base + (r() < 0.25 ? 1000 : 0);
      const f = p === 1 ? ri(r, 1, 9) * 100 : p === 2 ? ri(r, 1, 99) * 10 : ri(r, 1, 999);
      vals.add(wh + f);
    }
    const arr = [...vals];
    const toks = arr.map((m) => n2(decStr(m)));
    const order = arr.map((_, i) => i).sort((i, k2) => arr[i] - arr[k2]);
    return { gen: 'decOrder', fmt: 'order', values: toks, answer: { order }, key: [M_(...order.flatMap((i, z) => (z ? [op('<'), toks[i]] : [toks[i]])))] };
  };
  const placeNames = { 1000: 'אחדות', 10000: 'עשרות', 100: 'עשיריות', 10: 'מאיות', 1: 'אלפיות' };
  GEN.decPlace = (r, L) => {
    for (;;) {
      const p = L === 1 ? 2 : 3;
      const wh = L === 3 ? ri(r, 10, 99) : ri(r, 1, 9);
      const f = p === 2 ? ri(r, 11, 99) * 10 : ri(r, 101, 999);
      const m = wh * 1000 + f;
      const s = decStr(m);
      if (s.split('.')[1].length !== p) continue;
      const digits = s.replace(/[.,]/g, '').split('');
      const posVals = [];
      const [ip, fp] = s.split('.');
      ip.split('').forEach((dg, i) => posVals.push([dg, 1000 * 10 ** (ip.length - 1 - i)]));
      fp.split('').forEach((dg, i) => posVals.push([dg, 100 / 10 ** i]));
      const cands = posVals.filter(([dg, pv]) => dg !== '0' && digits.filter((z) => z === dg).length === 1 && (L === 3 || pv < 1000) && placeNames[pv]);
      if (!cands.length) continue;
      const [dg, pv] = pick(r, cands);
      const names = Object.entries(placeNames).filter(([k2]) => +k2 !== pv).map(([, v]) => v);
      const opts = shuffle(r, [placeNames[pv], ...shuffle(r, names).slice(0, 3)]);
      const correct = opts.indexOf(placeNames[pv]);
      return { gen: 'decPlace', fmt: 'choice', prompt: [`הספרה ${dg} במספר `, M_(n2(s)), ` מייצגת:`], options: opts.map((o) => [`${dg} ${o}`]), answer: { correct, num: s, digit: dg, names: opts }, key: [`${dg} ${placeNames[pv]}`] };
    }
  };
  GEN.decLine = (r, L) => {
    let start, step;
    if (L === 3) (start = ri(r, 0, 5) * 1000 + ri(r, 0, 9) * 100), (step = 10);
    else (start = ri(r, 0, L === 1 ? 2 : 6) * 1000), (step = 100);
    const kk = ri(r, 1, 9);
    const m = start + kk * step;
    return { gen: 'decLine', fmt: 'visual', visual: { kind: 'decline', start, step, at: kk, label: [decStr(start), decStr(start + 10 * step)] }, prompt: ['איזה מספר מסמן החץ?'], answer: { kind: 'dec', m }, key: [M_(n2(decStr(m)))] };
  };
  GEN.decRound = (r, L) => {
    const to = L === 1 ? 'whole' : L === 2 ? pick(r, ['whole', 'tenth']) : pick(r, ['tenth', 'hundredth', 'whole']);
    const m = to === 'hundredth' ? randDec(r, 3, 9) : randDec(r, to === 'tenth' ? 2 : pick(r, [1, 2]), 20);
    const unit = to === 'whole' ? 1000 : to === 'tenth' ? 100 : 10;
    if (m % unit === 0) return GEN.decRound(r, L);
    const res = Math.floor((m + unit / 2) / unit) * unit;
    const minP = to === 'whole' ? 0 : to === 'tenth' ? 1 : 2;
    const label = to === 'whole' ? 'למספר שלם' : to === 'tenth' ? 'לעשיריות' : 'למאיות';
    return { gen: 'decRound', fmt: 'expr', label, expr: [n2(decStr(m)), op('≈'), WB], answer: { kind: 'dec', m: res, unit, src: m }, key: [M_(n2(decStr(m)), op('≈'), n2(decStr(res, minP)))] };
  };
  GEN.decVert = (r, L) => {
    let a, b, o;
    for (;;) {
      o = L === 1 ? '+' : pick(r, ['+', '-']);
      const pa = L === 1 ? 1 : L === 2 ? 2 : pick(r, [1, 2, 3]);
      const pb = L === 3 ? pick(r, [1, 2]) : pa;
      a = randDec(r, pa, L === 1 ? 9 : 99);
      b = randDec(r, pb, L === 1 ? 9 : 99);
      if (o === '-' && a < b) [a, b] = [b, a];
      if (a % 1000 === 0 || b % 1000 === 0 || a === b) continue;
      if (L === 1 && (a % 1000) + (b % 1000) >= 1000) continue;
      break;
    }
    const v = o === '+' ? a + b : a - b;
    return { gen: 'decVert', fmt: 'vertical', rows: [decStr(a), decStr(b)], op: o, answer: { kind: 'dec', m: v }, key: [M_(n2(decStr(a)), op(o), n2(decStr(b)), op('='), n2(decStr(v)))] };
  };

  // ---- big numbers ----
  const unitsHe = ['יחידות', 'עשרות', 'מאות', 'אלפים', 'עשרות אלפים', 'מאות אלפים', 'מיליונים'];
  GEN.placeValue = (r, L) => {
    const len = L === 1 ? 4 : L === 2 ? ri(r, 5, 6) : 7;
    for (;;) {
      const digits = [ri(r, 1, 9), ...Array.from({ length: len - 1 }, () => ri(r, 0, 9))];
      const nn = Number(digits.join(''));
      const cand = digits.map((dg, i) => [dg, len - 1 - i]).filter(([dg]) => dg !== 0 && digits.filter((z) => z === dg).length === 1);
      if (!cand.length) continue;
      const [dg, pos] = pick(r, cand);
      return { gen: 'placeValue', fmt: 'expr', prompt: [`מה הערך של הספרה ${dg} במספר `, M_(n2(fmtInt(nn))), `?`], expr: [WB], answer: { kind: 'num', v: dg * 10 ** pos, n: nn, digit: dg }, key: [M_(n2(fmtInt(dg * 10 ** pos)))] };
    }
  };
  GEN.compose = (r, L) => {
    const top = L === 1 ? 3 : L === 2 ? 4 : 5;
    const parts = [];
    for (let p = top; p >= 0; p--) parts.push([p, p === top ? ri(r, 2, 9) : r() < (L === 1 ? 0.3 : 0.45) ? 0 : ri(r, 2, 9)]);
    if (!parts.some(([, dg]) => dg === 0)) parts[ri(r, 1, top)][1] = 0;
    const v = parts.reduce((s, [p, dg]) => s + dg * 10 ** p, 0);
    const txt = parts.filter(([, dg]) => dg).map(([p, dg]) => `${dg} ${unitsHe[p]}`);
    const said = txt.length > 1 ? txt.slice(0, -1).join(', ') + ' ו־' + txt[txt.length - 1] : txt[0];
    return { gen: 'compose', fmt: 'expr', prompt: [`${said} =`], expr: [WB], answer: { kind: 'num', v, parts }, key: [M_(n2(fmtInt(v)))] };
  };
  GEN.roundBig = (r, L) => {
    const to = L === 1 ? pick(r, [1, 2]) : L === 2 ? pick(r, [2, 3]) : pick(r, [3, 4]);
    const len = to + ri(r, 1, 2);
    let nn;
    do nn = ri(r, 10 ** (len - 1), 10 ** len - 1);
    while (nn % 10 ** to === 0);
    if (L === 3 && r() < 0.4) nn = (Math.floor(nn / 10 ** (to + 1)) * 10 + 9) * 10 ** to + ri(r, 5 * 10 ** (to - 1), 10 ** to - 1);
    const res = Math.round(nn / 10 ** to) * 10 ** to;
    const label = ['', 'לעשרות', 'למאות', 'לאלפים', 'לעשרות אלפים'][to];
    return { gen: 'roundBig', fmt: 'expr', label, expr: [n2(fmtInt(nn)), op('≈'), WB], answer: { kind: 'num', v: res, n: nn, to }, key: [M_(n2(fmtInt(nn)), op('≈'), n2(fmtInt(res)))] };
  };
  GEN.cmpBig = (r, L) => {
    let a, b;
    if (L === 1) { a = ri(r, 1000, 9999); const p = ri(r, 0, 3); b = a + (ri(r, 1, 3) * (r() < 0.5 ? 1 : -1)) * 10 ** p; if (b < 1000 || b > 9999) b = a + 10 ** p; }
    else if (L === 2) { const s = String(ri(r, 10000, 99999)).split(''); const i = ri(r, 2, 4); const t = s.slice(); [t[i - 1], t[i]] = [t[i], t[i - 1]]; a = +s.join(''); b = +t.join(''); if (a === b) b = a + 90; }
    else { const p = ri(r, 4, 5); a = 10 ** p - ri(r, 1, 9); b = 10 ** p + ri(r, 1, 9); if (r() < 0.3) b = a; }
    if (r() < 0.5) [a, b] = [b, a];
    const s = symOf(a, b);
    return { gen: 'cmpBig', fmt: 'expr', expr: [n2(fmtInt(a)), BL, n2(fmtInt(b))], answer: { kind: 'sym', v: s }, key: [M_(n2(fmtInt(a)), op(s), n2(fmtInt(b)))] };
  };

  // ---- divisibility ----
  const divBy = (nn, p) => nn % p === 0;
  GEN.divTable = (r, L) => {
    const cols = L === 1 ? [2, 5, 10] : L === 2 ? [2, 3, 5, 9, 10] : [2, 3, 5, 6, 9, 10];
    const nums = new Set();
    const lo = L === 1 ? 20 : L === 2 ? 100 : 1000, hi = L === 1 ? 999 : L === 2 ? 9999 : 99999;
    const makers = [
      () => ri(r, lo / 10, hi / 10) * 10,
      () => ri(r, lo / 5, hi / 5) * 5,
      () => ri(r, lo / 9, hi / 9) * 9,
      () => ri(r, lo / 3, hi / 3) * 3,
      () => ri(r, lo / 2, hi / 2) * 2 + 1,
      () => ri(r, lo, hi),
    ];
    let i = 0;
    while (nums.size < (L === 1 ? 5 : 6) && i < 100) nums.add(makers[i++ % makers.length]());
    const rows = [...nums];
    return { gen: 'divTable', fmt: 'table', corner: 'מתחלק ב־', cols: cols.map((c) => `${c}`), rows: rows.map((nn) => [n2(fmtInt(nn))]), answer: { cells: rows.map((nn) => cols.map((c) => divBy(nn, c))), nums: rows, cols }, key: rows.map((nn, z) => [z ? '  ·  ' : '', `${fmtInt(nn)}: `, cols.filter((c) => divBy(nn, c)).join(', ') || 'אף אחד']).flat() };
  };
  GEN.divDigit = (r, L) => {
    for (;;) {
      let p, digits, pos;
      if (L === 1) { p = pick(r, [2, 5, 10]); digits = [ri(r, 1, 9), ri(r, 0, 9), null]; pos = 2; }
      else if (L === 2) { p = pick(r, [3, 9]); digits = [ri(r, 1, 9), null, ri(r, 0, 9)]; pos = 1; }
      else { p = pick(r, [6, 9, 15, 4]); digits = [ri(r, 1, 9), ri(r, 0, 9), null, ri(r, 0, 9)]; pos = 2; if (p === 6 || p === 15) { digits = [ri(r, 1, 9), null, ri(r, 0, 9), p === 15 ? 5 : ri(r, 0, 4) * 2]; pos = 1; } if (p === 4) { digits = [ri(r, 1, 9), ri(r, 0, 9), null, ri(r, 0, 9)]; pos = 2; } }
      const ok = [];
      for (let dg = 0; dg <= 9; dg++) { const t = digits.slice(); t[pos] = dg; if (pos === 0 && dg === 0) continue; if (divBy(Number(t.join('')), p)) ok.push(dg); }
      if (!ok.length || ok.length === 10) continue;
      const shown = digits.map((dg) => (dg === null ? '□' : String(dg))).join('');
      return { gen: 'divDigit', fmt: 'word', work: 0, prompt: [`איזו ספרה אפשר לכתוב במשבצת, כך שהמספר `, M_({ t: 'dg', d: digits }), ` יתחלק ב־${p}? ${L === 3 ? 'כתבי את כל האפשרויות.' : 'מספיקה אפשרות אחת.'}`], answer: { kind: 'digits', ok, all: L === 3, digits, pos, p }, key: [ok.length === 1 ? `${ok[0]}` : `${ok.join(', ')}`], shown };
    }
  };
  GEN.divTF = (r, L) => {
    const p = pick(r, L === 1 ? [2, 5, 10] : L === 2 ? [3, 9, 5] : [3, 4, 6, 9]);
    const truth = r() < 0.5;
    let nn;
    const lo = L === 1 ? 100 : 1000, hi = L === 1 ? 9999 : 99999;
    let guard = 0;
    do nn = ri(r, lo, hi);
    while (divBy(nn, p) !== truth && guard++ < 1000);
    return { gen: 'divTF', fmt: 'tf', statement: [M_(n2(fmtInt(nn)))].concat([` מתחלק ב־${p} ללא שארית`]), answer: { value: divBy(nn, p), n: nn, p }, key: [divBy(nn, p) ? 'נכון' : `לא נכון (שארית ${nn % p})`] };
  };

  // ---- multiplication / division ----
  GEN.mental = (r, L) => {
    const v = pick(r, L === 1 ? ['x10', 'x100', 'd10'] : L === 2 ? ['x1000', 'd100', 'tens'] : ['tens', 'big', 'dtens']);
    let expr, ans;
    if (v === 'x10' || v === 'x100' || v === 'x1000') { const m = { x10: 10, x100: 100, x1000: 1000 }[v]; const a = ri(r, 2, L === 1 ? 99 : 999); expr = [n2(fmtInt(a)), op('*'), n2(fmtInt(m))]; ans = a * m; }
    else if (v === 'd10' || v === 'd100') { const m = v === 'd10' ? 10 : 100; ans = ri(r, 2, 999); expr = [n2(fmtInt(ans * m)), op(':'), n2(m)]; }
    else if (v === 'tens') { const a = ri(r, 2, 9) * 10, b = ri(r, 2, 9) * (L === 3 ? 100 : 10); expr = [n2(fmtInt(a)), op('*'), n2(fmtInt(b))]; ans = a * b; }
    else if (v === 'big') { const [a, b] = pick(r, [[25, 4], [25, 8], [125, 8], [50, 6], [250, 4], [20, 15]]); const kk = pick(r, [10, 100]); expr = [n2(fmtInt(a)), op('*'), n2(fmtInt(b * kk))]; ans = a * b * kk; }
    else { const b = ri(r, 2, 9) * 10; ans = ri(r, 2, 90); expr = [n2(fmtInt(ans * b)), op(':'), n2(b)]; }
    return { gen: 'mental', fmt: 'expr', expr: [...expr, op('='), WB], answer: { kind: 'num', v: ans }, key: [M_(...expr, op('='), n2(fmtInt(ans)))] };
  };
  GEN.mulVert = (r, L) => {
    const [la, lb] = L === 1 ? [2, 1] : L === 2 ? pick(r, [[3, 1], [2, 2]]) : pick(r, [[3, 2], [4, 1], [2, 2]]);
    const a = ri(r, 10 ** (la - 1) + 1, 10 ** la - 1), b = lb === 1 ? ri(r, 3, 9) : ri(r, 12, 99);
    return { gen: 'mulVert', fmt: 'vertical', rows: [String(a), String(b)], op: '*', work: lb === 2 ? 2 : 0, answer: { kind: 'num', v: a * b }, key: [M_(n2(a), op('*'), n2(b), op('='), n2(fmtInt(a * b)))] };
  };
  GEN.longDiv = (r, L) => {
    const dv = L === 3 && r() < 0.5 ? ri(r, 11, 25) : ri(r, 2, 9);
    const q = L === 1 ? ri(r, 11, 49) : L === 2 ? ri(r, 21, 199) : dv > 9 ? ri(r, 12, 99) : ri(r, 101, 999);
    const rem = L === 1 ? 0 : r() < 0.7 ? ri(r, 1, dv - 1) : 0;
    const nn = q * dv + rem;
    const expr = [n2(fmtInt(nn)), op(':'), n2(dv), op('='), WB];
    return { gen: 'longDiv', fmt: 'expr', expr, remainder: L > 1, answer: { kind: 'div', q, rem }, key: [M_(n2(fmtInt(nn)), op(':'), n2(dv), op('='), n2(fmtInt(q))), ...(L > 1 ? [`  שארית ${rem}`] : [])] };
  };

  // ---- order of operations ----
  // expression = token list over numbers and + − × : ( ) ; evaluated with standard precedence
  const evalOps = (toks) => {
    let i = 0;
    const peek = () => toks[i];
    const prim = () => {
      const t = toks[i++];
      if (t === '(') { const v = expr_(); i++; return v; }
      return t;
    };
    const term = () => {
      let v = prim();
      while (peek() === '*' || peek() === ':') { const o = toks[i++]; const b = prim(); if (o === ':') { if (b === 0 || v % b) return NaN; v /= b; } else v *= b; }
      return v;
    };
    const expr_ = () => {
      let v = term();
      while (peek() === '+' || peek() === '-') { const o = toks[i++]; const b = term(); v = o === '+' ? v + b : v - b; if (v < 0) return NaN; }
      return v;
    };
    return expr_();
  };
  const opsToks = (arr) => arr.map((t) => (typeof t === 'number' ? n2(t) : op(t === '*' ? '*' : t)));
  const templates = {
    1: [(a) => [a[0], '+', a[1], '*', a[2]], (a) => [a[0], '*', a[1], '+', a[2]], (a) => [a[0] * 4, '-', a[1], '*', a[2]], (a) => [a[0], '+', a[1] * a[2], ':', a[2]], (a) => [a[0], '*', a[1], '-', a[2]]],
    2: [(a) => ['(', a[0], '+', a[1], ')', '*', a[2]], (a) => [a[0], '*', '(', a[1] + a[2], '-', a[2], ')'], (a) => ['(', a[0] * a[2] + a[1] * a[2], '-', a[1] * a[2], ')', ':', a[2]], (a) => [a[0], '*', a[1], '+', a[2], '*', a[3]], (a) => [a[0] * a[1], ':', a[1], '+', a[2], '*', a[3]]],
    3: [(a) => [a[0], '*', '(', a[1], '+', a[2], ')', '-', a[3] * a[4], ':', a[4]], (a) => ['(', a[0], '+', a[1], ')', '*', '(', a[2] + a[3], '-', a[3], ')'], (a) => [a[0] * 6, '-', '(', a[1], '+', a[2] * a[3], ')', ':', a[3]], (a) => [a[0], '+', a[1], '*', a[2], '-', a[3]], (a) => [a[0] * (a[1] + a[2]), ':', '(', a[1], '+', a[2], ')', '+', a[3] * a[4]]],
  };
  GEN.opsCompute = (r, L) => {
    for (let g2 = 0; g2 < 200; g2++) {
      const a = Array.from({ length: 5 }, () => ri(r, 2, L === 1 ? 9 : 12));
      const t = pick(r, templates[L])(a);
      const v = evalOps(t);
      if (!Number.isInteger(v) || v < 0 || v > 999) continue;
      const toks = opsToks(t);
      return { gen: 'opsCompute', fmt: 'expr', expr: [...toks, op('='), WB], answer: { kind: 'num', v }, raw: t, key: [M_(...toks, op('='), n2(v))] };
    }
  };
  const leftToRight = (t) => {
    // the classic mistake: ignore precedence (no parentheses in these)
    let v = t[0];
    for (let i = 1; i < t.length; i += 2) { const b = t[i + 1]; v = t[i] === '+' ? v + b : t[i] === '-' ? v - b : t[i] === '*' ? v * b : v / b; }
    return v;
  };
  GEN.opsTF = (r, L) => {
    for (;;) {
      const a = Array.from({ length: 4 }, () => ri(r, 2, 9));
      const t = pick(r, [[a[0], '+', a[1], '*', a[2]], [a[0] * 5, '-', a[1], '*', a[2]], [a[0], '+', a[1] * a[2], ':', a[2]], [a[0], '*', a[1], '+', a[2], '*', a[3]]]);
      const right = evalOps(t), wrong = leftToRight(t);
      if (!Number.isInteger(right) || !Number.isInteger(wrong) || wrong < 0 || right === wrong) continue;
      const truth = r() < 0.4;
      const shown = truth ? right : wrong;
      return { gen: 'opsTF', fmt: 'tf', statement: [M_(...opsToks(t), op('='), n2(shown))], raw: t, shown, answer: { value: truth }, key: [truth ? 'נכון' : `לא נכון — התוצאה ${right}`] };
    }
  };
  GEN.opsParens = (r, L) => {
    for (;;) {
      const a = Array.from({ length: 3 }, () => ri(r, 2, L === 3 ? 12 : 9));
      const v = pick(r, [0, 1, 2, 3]);
      let plain, par;
      if (v === 0) (plain = [a[0], '+', a[1], '*', a[2]]), (par = ['(', a[0], '+', a[1], ')', '*', a[2]]);
      else if (v === 1) (plain = [a[0], '*', a[1], '+', a[2]]), (par = [a[0], '*', '(', a[1], '+', a[2], ')']);
      else if (v === 2) (plain = [a[0] * 3 + a[1], '-', a[1], '-', 1]), (par = [a[0] * 3 + a[1], '-', '(', a[1], '-', 1, ')']);
      else (plain = [a[0] * 2, '*', a[1] + 1, '-', a[1]]), (par = [a[0] * 2, '*', '(', a[1] + 1, '-', a[1], ')']);
      const target = evalOps(par), orig = evalOps(plain);
      if (!Number.isInteger(target) || target === orig || target < 0) continue;
      return { gen: 'opsParens', fmt: 'expr', prompt: [], expr: [...opsToks(plain), op('='), n2(target)], answer: { kind: 'parens', plain, par, target }, key: [M_(...opsToks(par), op('='), n2(target))] };
    }
  };

  // ---- geometry ----
  GEN.angleType = (r, L) => {
    const kinds = ['חדה', 'ישרה', 'קהה', 'שטוחה'];
    let deg;
    if (L === 1) deg = pick(r, [30, 40, 45, 60, 90, 90, 120, 135, 150, 180]);
    else { const t = pick(r, [0, 1, 2, 2, 0, 3]); deg = t === 0 ? ri(r, 15, 75) : t === 1 ? 90 : t === 2 ? ri(r, 105, 165) : 180; }
    const rot = L === 1 ? pick(r, [0, 0, 20, -15]) : ri(r, -60, 60);
    const correct = deg < 90 ? 0 : deg === 90 ? 1 : deg < 180 ? 2 : 3;
    return { gen: 'angleType', fmt: 'choice', visual: { kind: 'angle', deg, rot }, prompt: ['איזו זווית בציור?'], options: kinds.map((s) => [s]), answer: { correct, deg }, key: [kinds[correct]] };
  };
  GEN.triMissing = (r, L) => {
    for (;;) {
      let A_, B_, iso = false;
      if (L === 1) (A_ = ri(r, 3, 10) * 10), (B_ = ri(r, 3, 10) * 10);
      else if (L === 2) (A_ = ri(r, 6, 24) * 5), (B_ = ri(r, 6, 24) * 5);
      else if (r() < 0.5) (A_ = 90), (B_ = ri(r, 15, 75));
      else { const top = ri(r, 2, 14) * 10; A_ = (180 - top) / 2; B_ = A_; iso = true; }
      const Cc = 180 - A_ - B_;
      if (Cc < 20) continue;
      // labels at vertices [P0 (angle A), P1 (angle B), P2 (angle C)]
      const labels = iso ? ['?', '', `${Cc}°`] : [`${A_}°`, `${B_}°`, '?'];
      const v = iso ? A_ : Cc;
      return { gen: 'triMissing', fmt: 'visual', visual: { kind: 'triangle', A: A_, B: B_, iso, labels }, prompt: [iso ? 'המשולש שווה שוקיים. מה גודל הזווית המסומנת ב־?' : 'מה גודל הזווית המסומנת ב־?'], answer: { kind: 'num', v, A: A_, B: B_, iso }, unit: '°', key: [M_(n2(`${v}°`))] };
    }
  };
  GEN.triType = (r, L) => {
    for (;;) {
      const t = ri(r, 0, 2);
      let a, b, c;
      if (t === 1) (a = 90), (b = ri(r, 2, 16) * 5), (c = 90 - b);
      else if (t === 2) (a = ri(r, 19, 30) * 5), (b = ri(r, 2, 8) * 5), (c = 180 - a - b);
      else (a = ri(r, 9, 17) * 5), (b = ri(r, 9, 17) * 5), (c = 180 - a - b);
      if (c <= 0 || (t === 0 && (c >= 90 || c < 20))) continue;
      const ang = shuffle(r, [a, b, c]);
      const opts = ['חד־זווית', 'ישר־זווית', 'קהה־זווית'];
      const mx_ = Math.max(...ang);
      const correct = mx_ < 90 ? 0 : mx_ === 90 ? 1 : 2;
      return { gen: 'triType', fmt: 'choice', prompt: [`הזוויות במשולש הן ${ang.map((z) => z + '°').join(', ')}. איזה משולש זה?`], options: opts.map((o) => [o]), answer: { correct, angles: ang }, key: [opts[correct]] };
    }
  };
  GEN.lShape = (r, L) => {
    const W_ = ri(r, 5, L === 1 ? 8 : 12), H_ = ri(r, 4, L === 1 ? 7 : 10);
    const w_ = ri(r, 2, W_ - 2), h_ = ri(r, 2, H_ - 2);
    const ask = L === 3 && r() < 0.5 ? 'perim' : 'area';
    const v = ask === 'area' ? W_ * H_ - w_ * h_ : 2 * (W_ + H_);
    return { gen: 'lShape', fmt: 'visual', visual: { kind: 'lshape', W: W_, H: H_, w: w_, h: h_, grid: L === 1 }, prompt: [L === 1 ? 'כל משבצת היא 1 סמ״ר. מה השטח של הצורה?' : ask === 'area' ? 'מה השטח של הצורה? (המידות בס״מ)' : 'מה ההיקף של הצורה? (המידות בס״מ)'], answer: { kind: 'num', v, ask, W: W_, H: H_, w: w_, h: h_ }, unit: ask === 'area' ? 'סמ״ר' : 'ס״מ', key: [M_(n2(v)), ask === 'area' ? ' סמ״ר' : ' ס״מ'] };
  };

  // ---------- worksheet recipes ----------
  // part: [instruction, gen, [countL1, countL2, countL3], layout]
  const R = [
    { id: 'frac-equiv', dom: 'frac', title: 'שברים שקולים: הרחבה וצמצום', desc: 'משלימים מונה ומכנה, מצמצמים עד הסוף, נכון/לא נכון והתאמה', fmts: ['השלמה', 'נכון/לא נכון', 'בחירה', 'התאמה'],
      parts: [['השלימי את המספר החסר.', 'eqExpand', [6, 6, 6], 3], ['צמצמי עד הסוף.', 'eqSimplify', [6, 6, 6], 3], ['נכון או לא נכון? הקיפי.', 'eqTF', [4, 4, 4], 2], ['', 'eqOdd', [2, 2, 2], 2], ['חברי בקו כל שבר לשבר השווה לו.', 'eqMatch', [1, 1, 1], 1]] },
    { id: 'frac-compare', dom: 'frac', title: 'השוואת שברים במכנים שונים', desc: 'סימני השוואה, טבלת "ליד חצי" וסידור מהקטן לגדול', fmts: ['השלמה', 'טבלה', 'סידור'],
      parts: [['כתבי במשבצת >, < או =.', 'cmpDiff', [9, 9, 9], 3], ['סמני ✓ בעמודה המתאימה.', 'halfTable', [1, 1, 1], 1], ['סדרי מהקטן לגדול.', 'orderDiff', [2, 3, 3], 1]] },
    { id: 'frac-addsub', dom: 'frac', title: 'חיבור וחיסור שברים במכנים שונים', desc: 'מכנה משותף, השלמה לשלם ובעיות מילוליות', fmts: ['תרגילים', 'השלמה', 'בעיות מילוליות'],
      parts: [['חשבי. אפשר לכתוב את התשובה כשבר או כמספר מעורב.', 'addDiff', [4, 4, 4], 2], ['', 'subDiff', [4, 4, 4], 2], ['השלימי לשלם.', 'toWhole', [2, 2, 0], 2], ['פתרי.', 'wordDiff', [2, 3, 3], 1]] },
    { id: 'frac-mul', dom: 'frac', title: 'כפל שבר במספר שלם', desc: 'מחיבור חוזר לכפל, תרגילים ובעיות', fmts: ['השלמה', 'תרגילים', 'בעיות מילוליות'],
      parts: [['השלימי: חיבור חוזר הוא כפל.', 'repeatedAdd', [2, 2, 2], 1], ['חשבי.', 'fracTimes', [6, 6, 6], 2], ['פתרי.', 'mulWord', [2, 3, 3], 1]] },
    { id: 'dec-intro', dom: 'dec', title: 'שברים עשרוניים: כתיבה וקריאה', desc: 'משבר פשוט לעשרוני ובחזרה, ערך הספרה וישר מספרים', fmts: ['השלמה', 'בחירה', 'ישר מספרים'],
      parts: [['השלימי.', 'decFrac', [8, 8, 8], 2], ['הקיפי את התשובה הנכונה.', 'decPlace', [3, 3, 3], 1], ['', 'decLine', [2, 2, 2], 2]] },
    { id: 'dec-compare', dom: 'dec', title: 'השוואה, סידור ועיגול של עשרוניים', desc: 'מי גדול יותר? סידור ועיגול', fmts: ['השלמה', 'סידור', 'עיגול'],
      parts: [['כתבי במשבצת >, < או =.', 'decCompare', [9, 9, 9], 3], ['סדרי מהקטן לגדול.', 'decOrder', [2, 2, 2], 1], ['עגלי.', 'decRound', [6, 6, 6], 3]] },
    { id: 'dec-addsub', dom: 'dec', title: 'חיבור וחיסור עשרוניים במאונך', desc: 'נקודה מתחת לנקודה', fmts: ['במאונך'],
      parts: [['פתרי במאונך. שימי נקודה מתחת לנקודה.', 'decVert', [8, 8, 8], 4]] },
    { id: 'big-numbers', dom: 'num', title: 'מספרים גדולים: ערך מקום, השוואה ועיגול', desc: 'עד מיליונים, עם אפסים מבלבלים', fmts: ['השלמה', 'עיגול'],
      parts: [['', 'placeValue', [3, 3, 3], 1], ['כתבי את המספר בספרות.', 'compose', [3, 3, 3], 1], ['כתבי במשבצת >, < או =.', 'cmpBig', [6, 6, 6], 2], ['עגלי.', 'roundBig', [6, 6, 6], 2]] },
    { id: 'divisibility', dom: 'num', title: 'סימני התחלקות', desc: 'טבלת ✓/✗, ספרה חסרה ונכון/לא נכון', fmts: ['טבלה', 'השלמה', 'נכון/לא נכון'],
      parts: [['סמני ✓ אם המספר מתחלק, ו־✗ אם לא.', 'divTable', [1, 1, 1], 1], ['', 'divDigit', [3, 3, 3], 1], ['נכון או לא נכון? הקיפי.', 'divTF', [4, 4, 4], 2]] },
    { id: 'mul-div', dom: 'num', title: 'כפל וחילוק: בעל פה, במאונך וחילוק ארוך', desc: 'כפל באפסים, כפל במאונך וחילוק עם שארית', fmts: ['בעל פה', 'במאונך', 'חילוק ארוך'],
      parts: [['חשבי בעל פה.', 'mental', [6, 6, 6], 3], ['פתרי במאונך.', 'mulVert', [4, 4, 4], 4], ['פתרי בחילוק ארוך.', 'longDiv', [4, 4, 4], 2]] },
    { id: 'order-ops', dom: 'num', title: 'סדר פעולות חשבון', desc: 'כפל וחילוק לפני חיבור וחיסור, וסוגריים קודם', fmts: ['תרגילים', 'נכון/לא נכון', 'הוספת סוגריים'],
      parts: [['חשבי.', 'opsCompute', [8, 8, 8], 2], ['נכון או לא נכון? הקיפי.', 'opsTF', [4, 4, 4], 2], ['הוסיפי סוגריים כך שהתרגיל יהיה נכון.', 'opsParens', [2, 3, 3], 2]] },
    { id: 'angles', dom: 'geo', title: 'זוויות ומשולשים', desc: 'סוגי זוויות, סכום הזוויות במשולש וסוגי משולשים', fmts: ['ציור', 'בחירה', 'השלמה'],
      parts: [['', 'angleType', [4, 4, 4], 2], ['סכום הזוויות במשולש הוא 180°.', 'triMissing', [2, 3, 3], 2], ['', 'triType', [3, 3, 3], 1]] },
    { id: 'composite-area', dom: 'geo', title: 'שטח והיקף של צורות מורכבות', desc: 'מחלקים למלבנים, או משלימים למלבן', fmts: ['ציור', 'השלמה'],
      parts: [['פתרי. אפשר לחלק את הצורה למלבנים.', 'lShape', [4, 4, 4], 2]] },
    { id: 'review-frac', dom: 'mix', title: 'חזרה מעורבת: שברים', desc: 'שאלה או שתיים מכל נושא בשברים', fmts: ['מעורב'],
      parts: [['', 'eqSimplify', [2, 2, 2], 3], ['', 'cmpDiff', [3, 3, 3], 3], ['', 'addDiff', [2, 2, 2], 2], ['', 'subDiff', [2, 2, 2], 2], ['', 'fracTimes', [2, 2, 2], 2], ['', 'wordDiff', [1, 1, 1], 1], ['', 'mulWord', [1, 1, 1], 1]] },
    { id: 'review-all', dom: 'mix', title: 'חזרה מעורבת: עשרוניים, מספרים וגאומטריה', desc: 'סיכום קצר של כל הנושאים החדשים', fmts: ['מעורב'],
      parts: [['', 'decCompare', [3, 3, 3], 3], ['', 'decVert', [2, 2, 2], 4], ['', 'opsCompute', [2, 2, 2], 2], ['', 'longDiv', [2, 2, 2], 2], ['', 'roundBig', [2, 2, 2], 2], ['', 'triMissing', [1, 1, 1], 2], ['', 'lShape', [1, 1, 1], 2]] },
  ];
  const legacy = B.map((t) => ({ id: `topic-${t.id}`, dom: 'legacy', legacy: t.id, title: t.title, desc: `${t.short}. 10 שאלות ושאלת אתגר, רגיל או פתוח`, fmts: ['מבחן', 'פתוח'] }));
  const examRecipe = { id: 'exam', dom: 'legacy', legacy: '', title: 'מבחן מסכם: כל נושאי השברים, המלבן והישרים', desc: 'מבחן אקראי מכל ששת הנושאים, עם דף תשובות', fmts: ['מבחן', 'פתוח'] };
  const ALL = [...R, ...legacy, examRecipe];
  const DOMS = [
    ['frac', 'שברים'],
    ['legacy', 'שברים, מלבן וישרים — מבחנים ודפי עבודה'],
    ['dec', 'שברים עשרוניים'],
    ['num', 'מספרים ופעולות'],
    ['geo', 'גאומטריה'],
    ['mix', 'חזרה מעורבת'],
  ];
  const LEN = { s: 0.5, n: 1, l: 1.5 };

  const keyOf = (it) => [it.gen, JSON.stringify(it.expr ?? null), JSON.stringify(it.statement ?? null), JSON.stringify(it.prompt ?? null), JSON.stringify(it.values ?? null), JSON.stringify(it.visual ?? null), JSON.stringify(it.rows ?? null)].join('|');
  function buildSheet(recipe, seed, level, len = 'n') {
    const rng = k(seed);
    const seen = new Set();
    let no = 1;
    const parts = [];
    for (const [title, gen, counts, cols] of recipe.parts) {
      const base = counts[level - 1];
      if (!base) continue;
      const cnt = Math.max(1, Math.round(base * (LEN[len] ?? 1)));
      const items = [];
      for (let t = 0; items.length < cnt && t < cnt * 30; t++) {
        const it = GEN[gen](rng, level);
        const kk = keyOf(it);
        if (seen.has(kk)) continue;
        seen.add(kk);
        items.push({ ...it, no: no++ });
      }
      parts.push({ title, gen, cols, items });
    }
    return { id: recipe.id, title: recipe.title, seed, level, len, parts };
  }


  // ---------- wording (masculine forms for the new instructions) ----------
  for (const pr of [['צמצמי', 'צמצם'], ['הקיפי', 'הקף'], ['סמני', 'סמן'], ['עגלי', 'עגל'], ['הוסיפי', 'הוסף'], ['שימי', 'שים']])
    if (!mpgPairs.some((x) => x[0] === pr[0])) mpgPairs.push(pr);
  const say = (s, g) => mpgStr(s, g);

  // ---------- rendering ----------
  const LEVELS = [[1, 'קל'], [2, 'רגיל'], [3, 'מאתגר']];
  const LENS = [['s', 'קצר'], ['n', 'רגיל'], ['l', 'ארוך']];
  const LETTERS = 'אבגדהוזחטי';
  const DEF = {
    eqOdd: 'הקיפי את התשובה הנכונה.', subDiff: 'חשבי.', decLine: 'כתבי את המספר שהחץ מצביע עליו.', placeValue: 'כתבי את ערך הספרה.',
    divDigit: 'השלימי ספרה.', angleType: 'הקיפי את סוג הזווית.', triType: 'הקיפי את סוג המשולש.', eqSimplify: 'צמצמי עד הסוף.',
    cmpDiff: 'כתבי במשבצת >, < או =.', addDiff: 'חשבי.', fracTimes: 'חשבי.', wordDiff: 'פתרי.', mulWord: 'פתרי.', decCompare: 'כתבי במשבצת >, < או =.',
    decVert: 'פתרי במאונך.', opsCompute: 'חשבי.', longDiv: 'פתרי בחילוק ארוך.', roundBig: 'עגלי.', triMissing: 'סכום הזוויות במשולש הוא 180°.', lShape: 'פתרי.',
  };
  const Box = (cls = '') => h('span', { className: `blank-box ${cls}`, role: 'img', 'aria-label': 'משבצת ריקה' });
  const FracBox = (top, bottom) => hs('span', { className: 'frac lib-frac' }, [h('span', { className: 'frac-n' }, top), h('span', { className: 'frac-bar' }), h('span', { className: 'frac-d' }, bottom)]);
  function Tok({ t, size }) {
    if (t.t === 'wb') return Box('lib-wide');
    if (t.t === 'dg') return h('span', { className: 'lib-dg', 'aria-label': t.d.map((z) => (z === null ? 'משבצת' : z)).join(' ') }, ...t.d.map((z, i) => (z === null ? U.jsx('span', { className: 'blank-box lib-dgbox' }, i) : U.jsx('span', { children: z }, i))));
    if (t.t === 'mb') return hs('span', { className: 'mixed' }, [h('span', { className: 'blank-box blank-whole', role: 'img', 'aria-label': 'שלמים' }), h(eh, {})]);
    if (t.t === 'fb') return FracBox(t.n == null ? Box('lib-fbox') : t.n, t.d == null ? Box('lib-fbox') : t.d);
    return h(Ue, { t, size });
  }
  const Mx = ({ toks, size = 'md' }) => h('bdi', { dir: 'ltr', className: `math math-${size}` }, ...toks.map((t, i) => U.jsx(Tok, { t, size }, i)));
  const Rx = ({ r, g, size = 'sm' }) => U.jsx(U.Fragment, { children: (r || []).map((x, i) => (typeof x === 'string' ? U.jsx('span', { children: say(x, g) }, i) : U.jsx(Mx, { toks: x.math, size }, i))) });
  const Line = (unit) => hs('span', { className: 'lib-ans' }, [h('span', { className: 'exam-answer-label' }, 'תשובה:'), h('span', { className: 'exam-write-line', role: 'img', 'aria-label': 'שורת תשובה' }), unit ? h('span', { className: 'exam-unit' }, unit) : null]);
  const Work = (n) => h('div', { className: 'exam-workspace', 'aria-hidden': true }, ...Array.from({ length: n }, (_, i) => U.jsx('span', {}, i)));
  const Chips = (opts, g) => h('div', { className: 'exam-options lib-opts' }, ...opts.map((o, i) => hs('span', { className: 'exam-option' }, [h('span', { className: 'exam-option-label' }, `(${LETTERS[i]})`), h(Rx, { r: o, g })])));

  // svg: angle
  function AngleSvg({ v }) {
    const L_ = 80, rad = (a) => (a * Math.PI) / 180;
    const a0 = rad(v.rot), a1 = rad(v.rot + v.deg);
    const pts = [[0, 0], [L_ * Math.cos(a0), -L_ * Math.sin(a0)], [L_ * Math.cos(a1), -L_ * Math.sin(a1)]];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs, -24), maxX = Math.max(...xs, 24), minY = Math.min(...ys, -24), maxY = Math.max(...ys, 24);
    const W_ = maxX - minX + 24, H_ = maxY - minY + 24, ox = -minX + 12, oy = -minY + 12;
    const P_ = ([x_, y_]) => [x_ + ox, y_ + oy];
    const [vx, vy] = P_(pts[0]), [x1, y1] = P_(pts[1]), [x2, y2] = P_(pts[2]);
    const ar = 20, s0 = [vx + ar * Math.cos(a0), vy - ar * Math.sin(a0)], s1 = [vx + ar * Math.cos(a1), vy - ar * Math.sin(a1)];
    return hs('svg', { viewBox: `0 0 ${W_.toFixed(1)} ${H_.toFixed(1)}`, width: Math.min(200, W_ * 1.3), className: 'mx-auto block max-w-full', role: 'img', 'aria-label': 'זווית', direction: 'ltr' }, [
      h('path', { d: `M${s0[0].toFixed(1)} ${s0[1].toFixed(1)} A${ar} ${ar} 0 ${v.deg > 180 ? 1 : 0} 0 ${s1[0].toFixed(1)} ${s1[1].toFixed(1)}`, fill: 'none', stroke: '#F2705E', strokeWidth: 2 }),
      h('line', { x1: vx, y1: vy, x2: x1, y2: y1, stroke: '#22304A', strokeWidth: 3, strokeLinecap: 'round' }),
      h('line', { x1: vx, y1: vy, x2: x2, y2: y2, stroke: '#22304A', strokeWidth: 3, strokeLinecap: 'round' }),
      h('circle', { cx: vx, cy: vy, r: 3, fill: '#22304A' }),
    ]);
  }
  // svg: triangle from two angles (angle A at P0, B at P1)
  function TriSvg({ v }) {
    const rad = (a) => (a * Math.PI) / 180, Cc = 180 - v.A - v.B;
    const s0 = Math.sin(rad(v.B)) / Math.sin(rad(Cc));
    const P = [[0, 0], [1, 0], [s0 * Math.cos(rad(v.A)), s0 * Math.sin(rad(v.A))]];
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
    const sc = Math.min(200 / (maxX - minX), 110 / maxY), pad = 18;
    const Q = P.map(([x_, y_]) => [(x_ - minX) * sc + pad, (maxY - y_) * sc + pad]);
    const W_ = (maxX - minX) * sc + 2 * pad, H_ = maxY * sc + 2 * pad;
    const cx = (Q[0][0] + Q[1][0] + Q[2][0]) / 3, cy = (Q[0][1] + Q[1][1] + Q[2][1]) / 3;
    const lab = Q.map(([x_, y_]) => { const dx = cx - x_, dy = cy - y_, dl = Math.hypot(dx, dy) || 1; const t = Math.min(26, dl * 0.55); return [x_ + (dx / dl) * t, y_ + (dy / dl) * t]; });
    const ticks = v.iso ? [[0, 2], [1, 2]].map(([i, k2]) => { const mx_ = (Q[i][0] + Q[k2][0]) / 2, my = (Q[i][1] + Q[k2][1]) / 2, dx = Q[k2][0] - Q[i][0], dy = Q[k2][1] - Q[i][1], dl = Math.hypot(dx, dy); const nx = -dy / dl, ny = dx / dl; return h('line', { x1: mx_ - nx * 6, y1: my - ny * 6, x2: mx_ + nx * 6, y2: my + ny * 6, stroke: '#22304A', strokeWidth: 2 }); }) : [];
    return hs('svg', { viewBox: `0 0 ${W_.toFixed(1)} ${H_.toFixed(1)}`, width: Math.min(230, W_), className: 'mx-auto block max-w-full', role: 'img', 'aria-label': 'משולש', direction: 'ltr' }, [
      h('polygon', { points: Q.map((p) => p.map((z) => z.toFixed(1)).join(',')).join(' '), fill: '#D5F0EC', stroke: '#22304A', strokeWidth: 2.5, strokeLinejoin: 'round' }),
      ...ticks,
      ...v.labels.map((t, i) => (t ? h('text', { x: lab[i][0].toFixed(1), y: (lab[i][1] + 5).toFixed(1), textAnchor: 'middle', fontSize: 14, fontWeight: 700, fill: t === '?' ? '#F2705E' : '#22304A' }, t) : null)),
    ]);
  }
  // svg: decimal number line with an arrow
  function DecLineSvg({ v }) {
    const x0 = 20, x1 = 320, y = 52, dx = (x1 - x0) / 10;
    const ax = x0 + v.at * dx;
    return hs('svg', { viewBox: '0 0 340 80', width: 340, className: 'mx-auto block max-w-full', role: 'img', 'aria-label': 'ישר מספרים עם חץ', direction: 'ltr' }, [
      h('line', { x1: x0 - 8, y1: y, x2: x1 + 8, y2: y, stroke: '#22304A', strokeWidth: 2.5 }),
      ...Array.from({ length: 11 }, (_, i) => h('line', { x1: x0 + i * dx, y1: y - (i % 5 === 0 ? 9 : 6), x2: x0 + i * dx, y2: y + (i % 5 === 0 ? 9 : 6), stroke: '#22304A', strokeWidth: i % 10 === 0 ? 2.5 : 1.6 })),
      h('text', { x: x0, y: y + 26, textAnchor: 'middle', fontSize: 14, fontWeight: 700, fill: '#22304A' }, v.label[0]),
      h('text', { x: x1, y: y + 26, textAnchor: 'middle', fontSize: 14, fontWeight: 700, fill: '#22304A' }, v.label[1]),
      h('path', { d: `M${ax} ${y - 12} L${ax - 6} ${y - 24} L${ax - 2} ${y - 24} L${ax - 2} ${y - 40} L${ax + 2} ${y - 40} L${ax + 2} ${y - 24} L${ax + 6} ${y - 24} Z`, fill: '#F2705E' }),
    ]);
  }
  // svg: L-shape (rectangle W×H with a w×h notch cut from the top-right corner)
  function LShapeSvg({ v }) {
    const u = Math.min(200 / v.W, 120 / v.H), pad = 26;
    const X = (a) => pad + a * u, Y = (b) => pad + b * u;
    const pts = [[0, 0], [v.W - v.w, 0], [v.W - v.w, v.h], [v.W, v.h], [v.W, v.H], [0, v.H]];
    const kids = [h('polygon', { points: pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(' '), fill: '#D5F0EC', stroke: '#22304A', strokeWidth: 2.5, strokeLinejoin: 'round' })];
    if (v.grid) {
      for (let a = 1; a < v.W; a++) kids.push(h('line', { x1: X(a), y1: Y(a > v.W - v.w ? v.h : 0), x2: X(a), y2: Y(v.H), stroke: '#1F9E8F', strokeWidth: 1 }));
      for (let b = 1; b < v.H; b++) kids.push(h('line', { x1: X(0), y1: Y(b), x2: X(b < v.h ? v.W - v.w : v.W), y2: Y(b), stroke: '#1F9E8F', strokeWidth: 1 }));
    } else {
      const T_ = (x_, y_, t, anchor = 'middle') => h('text', { x: x_.toFixed(1), y: y_.toFixed(1), textAnchor: anchor, fontSize: 14, fontWeight: 700, fill: '#22304A' }, t);
      kids.push(T_(X(v.W / 2), Y(v.H) + 18, v.W), T_(X(0) - 8, Y(v.H / 2) + 5, v.H, 'end'), T_(X(v.W - v.w / 2), Y(v.h) - 6, v.w), T_(X(v.W - v.w) - 6, Y(v.h / 2) + 5, v.h, 'end'));
    }
    const W_ = X(v.W) + pad, H_ = Y(v.H) + pad;
    return hs('svg', { viewBox: `0 0 ${W_.toFixed(1)} ${H_.toFixed(1)}`, width: Math.min(260, W_), className: 'mx-auto block max-w-full', role: 'img', 'aria-label': 'צורה מורכבת ממלבנים', direction: 'ltr' }, kids);
  }
  const Visual = ({ v }) =>
    v.kind === 'angle' ? h(AngleSvg, { v }) : v.kind === 'triangle' ? h(TriSvg, { v }) : v.kind === 'decline' ? h(DecLineSvg, { v }) : v.kind === 'lshape' ? h(LShapeSvg, { v }) : null;
  const visualCls = (v) => `exam-visual ${v.kind === 'decline' ? 'exam-visual-wide' : v.kind === 'lshape' || v.kind === 'triangle' ? 'exam-visual-draw' : ''}`;

  // vertical arithmetic: digits aligned at the decimal point, empty boxes for the result
  function Vertical({ it, solved }) {
    const rows = it.rows.map((s) => s.replace(/,/g, ''));
    const split = (s) => { const [a, b = ''] = s.split('.'); return [a, b]; };
    const res = solved ? (it.answer.kind === 'dec' ? decStr(it.answer.m) : String(it.answer.v)).replace(/,/g, '') : null;
    const parts = rows.map(split);
    let intW = Math.max(...parts.map((p) => p[0].length)) + 1;
    const fracW = Math.max(...parts.map((p) => p[1].length));
    if (it.op === '*') intW = rows[0].length + rows[1].length;
    const cols = intW + (fracW ? fracW + 1 : 0) + 1;
    const cells = [];
    const put = (key, cls, txt) => cells.push(U.jsx('span', { className: `lib-vc ${cls}`, children: txt }, key));
    const row = (ri_, sym, [ip, fp], kind) => {
      put(`o${ri_}`, 'lib-vop', sym);
      for (let c = 0; c < intW; c++) { const ch_ = ip[ip.length - intW + c]; put(`${ri_}i${c}`, kind === 'box' ? 'lib-vb' : '', kind === 'box' ? (ch_ ?? '') : ch_ ?? ''); }
      if (fracW) { put(`${ri_}p`, 'lib-vpt', kind === 'box' || fp.length ? '.' : ''); for (let c = 0; c < fracW; c++) put(`${ri_}f${c}`, kind === 'box' ? 'lib-vb' : '', fp[c] ?? ''); }
    };
    row(0, '', parts[0]);
    row(1, it.op === '*' ? '×' : it.op === '-' ? '−' : '+', parts[1]);
    cells.push(U.jsx('span', { className: 'lib-vline' }, 'l1'));
    if (it.work && !solved) { for (let z = 0; z < it.work; z++) row(`w${z}`, z ? '+' : '', ['', ''], 'box'); cells.push(U.jsx('span', { className: 'lib-vline' }, 'l2')); }
    row('r', '', res ? split(res) : ['', ''], 'box');
    return h('div', { className: 'lib-vert', dir: 'ltr', style: { gridTemplateColumns: `repeat(${cols}, 1.25em)` }, role: 'img', 'aria-label': `תרגיל במאונך: ${rows[0]} ${it.op === '*' ? 'כפול' : it.op === '-' ? 'פחות' : 'ועוד'} ${rows[1]}` }, cells);
  }

  function Table({ it, solved }) {
    const mark = (r_, c) => (it.answer.cells ? (it.answer.cells[r_][c] ? '✓' : '✗') : it.answer.choice[r_] === c ? '✓' : '');
    return h('table', { className: 'lib-table' },
      hs('thead', {}, [hs('tr', {}, [h('th', {}, it.corner || ''), ...it.cols.map((c, i) => U.jsx('th', { scope: 'col', children: c }, i))])]),
      h('tbody', {}, ...it.rows.map((rw, r_) => U.jsxs('tr', { children: [h('th', { scope: 'row' }, h(Mx, { toks: rw, size: 'sm' })), ...it.cols.map((_, c) => U.jsx('td', { className: solved && mark(r_, c) === '✓' ? 'lib-yes' : '', children: solved ? mark(r_, c) : '' }, c))] }, r_))));
  }

  function Item({ it, g }) {
    const no = h('bdi', { dir: 'rtl', className: 'exam-q-no' }, `${it.no}.`);
    let body;
    switch (it.fmt) {
      case 'expr':
        body = [it.label ? h('span', { className: 'lib-label' }, say(it.label, g)) : null, it.prompt?.length ? h('span', { className: 'lib-prompt' }, h(Rx, { r: it.prompt, g })) : null, h(Mx, { toks: it.expr }), it.remainder ? hs('span', { className: 'lib-rem' }, ['שארית:', Box('lib-wide')]) : null];
        break;
      case 'word':
        return hs('div', { className: 'exam-q lib-item lib-word' }, [hs('p', { className: 'exam-q-prompt rich-line lib-full' }, [no, h(Rx, { r: it.prompt, g })]), Line(it.unit), it.work === 0 ? null : Work(it.work ?? 2)]);
        break;
      case 'choice':
        if (it.prompt) return hs('div', { className: 'exam-q lib-item lib-choice' }, [hs('span', { className: 'lib-prompt lib-full' }, [no, h(Rx, { r: it.prompt, g })]), it.visual ? h('div', { className: visualCls(it.visual) }, h(Visual, { v: it.visual })) : null, Chips(it.options, g)]);
        body = [ it.visual ? h('div', { className: visualCls(it.visual) }, h(Visual, { v: it.visual })) : null, Chips(it.options, g)];
        break;
      case 'tf':
        body = [h('span', { className: 'lib-prompt' }, h(Rx, { r: it.statement, g, size: 'md' })), Chips([['נכון'], ['לא נכון']], g)];
        break;
      case 'order':
        // values and answer boxes as separate chunks so they wrap on narrow screens (math order stays left-to-right)
        body = [
          h('div', { className: 'lib-full lib-ord', dir: 'ltr' }, ...it.values.map((t, i) => U.jsx(Mx, { toks: i < it.values.length - 1 ? [t, { t: 'op', v: ',' }] : [t] }, i))),
          hs('div', { className: 'lib-full lib-ord-ans' }, [h('span', { className: 'exam-answer-label' }, 'תשובה:'), h('div', { className: 'lib-ord', dir: 'ltr' }, ...it.values.map((_, i) => U.jsx(Mx, { toks: i < it.values.length - 1 ? [WB, op('<')] : [WB] }, i)))]),
        ];
        break;
      case 'match':
        body = [hs('div', { className: 'lib-match lib-full' }, [
          h('ol', { className: 'lib-match-col' }, ...it.left.map((t, i) => U.jsxs('li', { children: [h('span', { className: 'lib-ml' }, `${LETTERS[i]}.`), h(Mx, { toks: t, size: 'sm' }), h('span', { className: 'lib-dot', 'aria-hidden': true })] }, i))),
          h('ol', { className: 'lib-match-col' }, ...it.right.map((t, i) => U.jsxs('li', { children: [h('span', { className: 'lib-dot', 'aria-hidden': true }), h(Mx, { toks: t, size: 'sm' }), h('span', { className: 'lib-ml' }, `${i + 1}.`)] }, i))),
        ])];
        break;
      case 'table':
        body = [h('div', { className: 'lib-full lib-scroll' }, h(Table, { it }))];
        break;
      case 'vertical':
        body = [h(Vertical, { it })];
        break;
      case 'visual':
        return hs('div', { className: 'exam-q lib-item lib-visual' }, [hs('span', { className: 'lib-prompt lib-full' }, [no, h(Rx, { r: it.prompt, g })]), h('div', { className: visualCls(it.visual) }, h(Visual, { v: it.visual })), Line(it.unit)]);
        break;
    }
    return hs('div', { className: `exam-q lib-item lib-${it.fmt}` }, [no, ...body.filter(Boolean)]);
  }

  const levelName = (l) => LEVELS.find((x) => x[0] === l)?.[1] ?? '';
  function Paper({ sheet, g }) {
    return hs('article', { className: 'exam-paper lib-paper', 'aria-label': 'דף העבודה' }, [
      hs('header', { className: 'exam-head' }, [
        h('h2', { className: 'exam-title' }, `${sheet.title} — כיתה ה׳`),
        hs('div', { className: 'exam-fields' }, [h('span', {}, 'שם: ____________'), h('span', {}, 'תאריך: ________'), h('span', {}, `רמה: ${levelName(sheet.level)}`)]),
      ]),
      ...sheet.parts.map((p, i) => U.jsxs('section', { className: 'exam-section', children: [
        h('h3', { className: 'exam-section-title' }, `${LETTERS[i]}. ${say(p.title || DEF[p.gen] || '', g)}`),
        h('div', { className: `lib-grid lib-cols-${p.cols}` }, ...p.items.map((it) => U.jsx(Item, { it, g }, it.no))),
      ] }, i)),
      h('p', { className: 'lib-code' }, `קוד הדף: ${sheet.seed} · ${sheet.id} · חשבון לכיתה ה׳`),
    ]);
  }
  function KeyItem({ it, g }) {
    if (it.fmt === 'table') return hs('li', { className: 'lib-key-wide' }, [h('b', {}, `${it.no}. `), h('div', { className: 'lib-scroll' }, h(Table, { it, solved: true }))]);
    if (it.fmt === 'vertical') return hs('li', {}, [h('b', {}, `${it.no}. `), h(Rx, { r: it.key, g })]);
    return hs('li', {}, [h('b', {}, `${it.no}. `), h(Rx, { r: it.key, g })]);
  }
  function KeyPaper({ sheet, g }) {
    return hs('article', { className: 'exam-paper exam-answers lib-paper', 'aria-label': 'דף תשובות' }, [
      h('h2', { className: 'exam-title' }, `דף תשובות — ${sheet.title}`),
      ...sheet.parts.map((p, i) => U.jsxs('section', { className: 'exam-answers-section', children: [
        h('h3', { className: 'exam-section-title' }, `${LETTERS[i]}. ${say(p.title || DEF[p.gen] || '', g)}`),
        h('ol', { className: 'lib-key' }, ...p.items.map((it) => U.jsx(KeyItem, { it, g }, it.no))),
      ] }, i)),
      h('p', { className: 'lib-code' }, `קוד הדף: ${sheet.seed} · רמה: ${levelName(sheet.level)}`),
    ]);
  }

  // ---------- pages ----------
  const findRecipe = (id) => ALL.find((x) => x.id === id);
  const sheetUrl = (id, q) => `/library/${id}?${new URLSearchParams(Object.entries(q).filter(([, v]) => v != null)).toString()}`;
  const Chip = (active, onClick, label, key) => U.jsx('button', { type: 'button', onClick, 'aria-pressed': active, className: `min-h-[44px] rounded-full px-4 text-base font-bold ring-2 transition ${active ? 'bg-ink text-cream ring-ink' : 'bg-white text-ink ring-ink/10'}`, children: label }, key);
  const Group = (label, kids) => hs('div', { className: 'flex flex-wrap items-center gap-2', role: 'group', 'aria-label': label }, [h('span', { className: 'w-full text-sm font-bold text-ink/60', 'aria-hidden': true }, label), ...kids]);
  const useTitle = (t) => y.useEffect(() => { const old = document.title; document.title = t; return () => { document.title = old; }; }, [t]);

  function LibraryHome() {
    const [sel, setSel] = y.useState(R[0].id);
    const [lvl, setLvl] = y.useState(2);
    const [len, setLen] = y.useState('n');
    useTitle('ספריית דפי עבודה — חשבון לכיתה ה׳');
    const rec = findRecipe(sel);
    const go = () => W(sheetUrl(sel, rec.legacy !== undefined ? { l: lvl } : { l: lvl, n: len }));
    return h(ye, { title: 'ספריית דפי עבודה', stars: false }, hs('div', { className: 'flex flex-col gap-4' }, [
      h('p', { className: 'text-base text-ink/75' }, `${ALL.length} סוגי דפים לכיתה ה׳, כל אחד בשלוש רמות ועם דף תשובות. בכל לחיצה נוצר דף חדש, וכל דף אפשר להדפיס, לשמור כ־PDF או לשלוח בקישור.`),
      hs('section', { className: 'lib-quick', 'aria-labelledby': 'lib-quick-h' }, [
        h('h2', { id: 'lib-quick-h', className: 'text-lg font-extrabold' }, 'דף מהיר'),
        hs('label', { className: 'lib-field' }, [h('span', { className: 'text-sm font-bold text-ink/60' }, 'נושא'),
          h('select', { className: 'lib-select', value: sel, onChange: (e) => setSel(e.target.value) },
            ...DOMS.map(([d, name]) => U.jsx('optgroup', { label: name, children: ALL.filter((x) => x.dom === d).map((x) => U.jsx('option', { value: x.id, children: x.title }, x.id)) }, d)))]),
        Group('רמת קושי', LEVELS.map(([l, n_]) => Chip(lvl === l, () => setLvl(l), n_, l))),
        rec.legacy === undefined ? Group('אורך הדף', LENS.map(([l, n_]) => Chip(len === l, () => setLen(l), n_, l))) : null,
        h(xe, { onClick: go }, 'יצירת הדף'),
      ]),
      hs('nav', { className: 'lib-jump', 'aria-label': 'קפיצה לתחום' }, DOMS.map(([d, name], di) => U.jsx('button', { type: 'button', className: `lib-jump-chip lib-jump-${di % 3}`, onClick: () => document.getElementById(`dom-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), children: name.split(' — ')[0] }, d))),
      ...DOMS.map(([d, name], di) => U.jsxs('section', { className: 'flex flex-col gap-3', 'aria-labelledby': `dom-${d}`, children: [
        hs('h2', { id: `dom-${d}`, className: 'lib-dom' }, [h('span', { className: `lib-dom-mark lib-dom-${di % 3}`, 'aria-hidden': true }), name]),
        ...ALL.filter((x) => x.dom === d).map((x) => U.jsxs('article', { className: 'lib-card', children: [
          h('h3', { className: 'text-lg font-bold leading-snug' }, x.title),
          h('p', { className: 'text-sm text-ink/65' }, x.desc),
          h('div', { className: 'lib-tags' }, ...x.fmts.map((f) => U.jsx('span', { className: 'lib-tag', children: f }, f))),
          hs('div', { className: 'lib-levels', role: 'group', 'aria-label': `${x.title}: בחירת רמה` }, LEVELS.map(([l, n_]) => U.jsx(ae, { to: sheetUrl(x.id, { l }), className: 'lib-lv', 'aria-label': `${x.title}, רמה ${n_}`, children: n_ }, l))),
        ] }, x.id)),
      ] }, d)),
      h(__app.InstallBar, {}),
    ]));
  }

  function LibrarySheet() {
    const { sheet: id } = se();
    const [qs] = ce();
    const rec = findRecipe(id);
    const level = [1, 2, 3].includes(+qs.get('l')) ? +qs.get('l') : 2;
    const len = ['s', 'n', 'l'].includes(qs.get('n')) ? qs.get('n') : 'n';
    const mode = qs.get('m') === 'open' ? 'open' : 'normal';
    const seedQ = qs.get('s');
    const seed = seedQ && /^\d{1,10}$/.test(seedQ) ? +seedQ : null;
    const [gender, setGender] = y.useState(() => mpgGet());
    const [showKey, setShowKey] = y.useState(false);
    const [busy, setBusy] = y.useState(false);
    const [msg, setMsg] = y.useState('');
    const root = y.useRef(null);
    const isLegacy = rec && rec.legacy !== undefined;
    const params = (over) => ({ l: level, ...(isLegacy ? (mode === 'open' ? { m: 'open' } : {}) : { n: len }), s: seed, ...over });
    y.useEffect(() => { if (rec && seed === null) W(sheetUrl(id, params({ s: N() % 1e9 })), true); }, [rec, seed]);
    const data = y.useMemo(() => {
      if (!rec || seed === null) return null;
      if (isLegacy) return mpgAdaptExam(rec.legacy ? wsBuild(seed, level, rec.legacy) : li(seed, level), gender);
      return buildSheet(rec, seed, level, len);
    }, [id, seed, level, len, gender]);
    useTitle(rec ? `${rec.title} — דף עבודה לכיתה ה׳` : 'ספריית דפי עבודה');
    if (!rec) return h(G, { to: '/library', replace: true });
    if (!gender) return mpgGate(rec.title, setGender, '/library');
    if (!data) return h(ye, { title: rec.title, back: '/library', stars: false }, h('p', { className: 'text-base', role: 'status' }, 'יוצרים דף…'));
    const nav = (over) => W(sheetUrl(id, params(over)), true);
    const pdfName = `math-${id}-${['', 'easy', 'regular', 'hard'][level]}-${seed}.pdf`;
    const download = async () => {
      const el = root.current;
      if (!el || busy) return;
      setBusy(true), setShowKey(true), setMsg('');
      try {
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const paper = el.querySelector('.exam-paper:not(.exam-answers)'), ans = el.querySelector('.exam-answers');
        if (!paper || !ans) throw Error('sheet not rendered');
        const { downloadExamPdf: dl } = await Ci(async () => { const { downloadExamPdf: e } = await Promise.resolve().then(() => (Gm(), Om)); return { downloadExamPdf: e }; }, void 0, import.meta.url);
        await dl(paper, ans, pdfName);
        setMsg('קובץ ה־PDF ירד.');
      } catch (e) {
        console.error(e);
        setMsg('לא הצלחנו ליצור PDF. אפשר להשתמש בכפתור ההדפסה ולבחור "שמירה כ־PDF".');
      } finally {
        setBusy(false);
      }
    };
    const share = async () => {
      const url = location.href;
      try {
        if (navigator.share) { await navigator.share({ title: rec.title, text: `${rec.title} — דף עבודה לכיתה ה׳`, url }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(url); setMsg('הקישור הועתק. מי שיפתח אותו יקבל את אותו דף בדיוק.'); }
      catch { setMsg('אפשר להעתיק את הכתובת משורת הכתובת של הדפדפן.'); }
    };
    return h(ye, { title: rec.title, back: '/library', stars: false }, hs('div', { ref: root, className: 'exam-print-root flex flex-col gap-4' }, [
      hs('div', { className: 'no-print flex flex-col gap-3' }, [
        h('p', { className: 'text-base text-ink/75' }, rec.desc),
        Group('רמת קושי', LEVELS.map(([l, n_]) => Chip(level === l, () => nav({ l }), n_, l))),
        isLegacy ? Group('סוג הדף', [['normal', 'רגיל'], ['open', 'פתוח']].map(([m, n_]) => Chip(mode === m, () => nav({ m: m === 'open' ? 'open' : undefined }), n_, m))) : Group('אורך הדף', LENS.map(([l, n_]) => Chip(len === l, () => nav({ n: l }), n_, l))),
        Group('לשון הפנייה', [['f', 'נקבה'], ['m', 'זכר']].map(([gg, n_]) => Chip(gender === gg, () => { mpgSet(gg), setGender(gg); }, n_, gg))),
        h(xe, { onClick: () => nav({ s: N() % 1e9 }), disabled: busy }, 'דף חדש עם מספרים אחרים'),
        h(xe, { onClick: download, disabled: busy }, h('span', { 'aria-live': 'polite' }, busy ? 'יוצרים PDF…' : 'הורדת PDF')),
        hs('div', { className: 'lib-2col' }, [h(Se, { onClick: () => window.print() }, 'הדפסה'), h(Se, { onClick: share }, 'שיתוף קישור')]),
        h('p', { className: 'text-sm text-ink/65', role: 'status', 'aria-live': 'polite' }, msg),
      ]),
      isLegacy ? h(oh, { exam: data, mode }) : h(Paper, { sheet: data, g: gender }),
      h('div', { className: 'no-print' }, hs(Se, { onClick: () => setShowKey((v) => !v) }, [h('span', { 'aria-hidden': true }, showKey ? '▴ ' : '▾ '), showKey ? 'הסתרת דף תשובות' : 'הצגת דף תשובות'])),
      h('div', { className: `exam-answers-page ${showKey || busy ? '' : 'answers-collapsed'}`, 'aria-hidden': !(showKey || busy) }, isLegacy ? h(ch, { exam: data, mode }) : h(KeyPaper, { sheet: data, g: gender })),
    ]));
  }

  // ---------- registration ----------
  ee.push({ re: /^\/library$/, name: 'library' }, { re: /^\/library\/([A-Za-z0-9-]+)$/, name: 'librarySheet', param: 'sheet' });
  fh.library = LibraryHome;
  fh.librarySheet = LibrarySheet;
  uh.push({ to: '/library', title: 'ספריית דפי עבודה', text: `${ALL.length} סוגי דפים בשלוש רמות, עם דפי תשובות`, color: 'bg-teal-soft', mark: '▤' });

  return { GEN, R, ALL, DOMS, buildSheet, evalOps, decStr, fmtInt, ratTok, gcd, LibraryHome, LibrarySheet };
})();
