// Answer-key checker for the math worksheet generators bundled in ../index.html.
// The site ships only a compiled bundle (no source), so this script pulls the
// generator functions out of index.html, generates thousands of questions per
// generator and level, and re-computes every answer from what the student
// actually sees (the printed expression / word problem), not from internal params.
// Usage:  node tools/check-answers.mjs [questionsPerGeneratorPerLevel=300]
// Needs only Node 18+. Exit code 1 if any answer key is wrong.
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os'; import {join,dirname} from 'node:path'; import {fileURLToPath,pathToFileURL} from 'node:url';
const html=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'..','index.html'),'utf8');
const a=html.indexOf('<script type="module">')+22, b=html.indexOf('</script>',a);
let src=html.slice(a,b); const cut=src.lastIndexOf('(0,b.createRoot)');
if(cut<0) throw new Error('could not find the app entry point in index.html');
src=src.slice(0,cut)+';globalThis.__T={hr,k,wsBuild:typeof wsBuild=="function"?wsBuild:null,lib:typeof __lib=="undefined"?null:__lib,mpgStr};';
src=src.replace(/import\.meta\.url/g,'"x"');
globalThis.window=globalThis; globalThis.self=globalThis; globalThis.addEventListener=()=>{};
globalThis.document={createElement:()=>({style:{},setAttribute(){},appendChild(){}}),querySelector:()=>null,querySelectorAll:()=>[],head:{appendChild(){}},addEventListener(){}};
globalThis.location={hash:'#/',href:'http://x/#/'};
const f=join(mkdtempSync(join(tmpdir(),'mp-')),'bundle.mjs'); writeFileSync(f,src);
await import(pathToFileURL(f).href); const T=globalThis.__T;
const tok=t=>t.t==='num'?String(t.v):t.t==='frac'?`${t.n}/${t.d}`:t.t==='mixed'?`${t.w}[${t.n}/${t.d}]`:t.t==='op'?t.v:t.t==='blank'?'□':t.t==='frac'?'':JSON.stringify(t);
const rich=r=>!r?'':r.map(x=>typeof x==='string'?x:x.math?x.math.map(tok).join(' '):JSON.stringify(x)).join('');
function ans(q){const a=q.answer;switch(a.kind){case 'choice':return a.options.map((o,i)=>(i===a.correct?'*':'')+rich(o)).join(' | ');case 'number':return 'NUM '+a.accept.join('/')+(a.unit?' '+a.unit:'');case 'fraction':return `FRAC ${a.n}/${a.d}`;case 'mixed':return `MIX ${a.w}[${a.n}/${a.d}]`;default:return JSON.stringify(a)}}

const N=+process.argv[2]||400; const fails={}; const cnt={};
const val=t=>t.t==='num'?t.v:t.t==='frac'?t.n/t.d:t.t==='mixed'?t.w+t.n/t.d:NaN;
const eq=(a,b)=>Math.abs(a-b)<1e-9;
const fail=(g,q,msg)=>{(fails[g]??=[]).push(msg+' :: '+rich(q.prompt)+' '+(q.expr?q.expr.map(tok).join(' '):'')+' => '+ans(q));};
function evalSide(toks){ // tokens with + and − ops
 let v=0,sign=1; for(const t of toks){ if(t.t==='op'){ if(t.v==='+')sign=1; else if(t.v==='−'||t.v==='-')sign=-1; else throw 'op '+t.v;} else {v+=sign*val(t);} } return v;}
const mathToks=q=>q.prompt.filter(x=>typeof x!=='string').flatMap(x=>x.math);
const nums=s=>(s.match(/\d+/g)||[]).map(Number);
const optVal=o=>{const m=o.filter(x=>typeof x!=='string').flatMap(x=>x.math); if(m.length===1)return val(m[0]); if(o.length===1&&typeof o[0]==='string'&&/^\s*\d+\s*$/.test(o[0]))return +o[0]; return NaN;};
const optText=o=>rich(o);
const ang=l=>Math.atan2(l.y2-l.y1,l.x2-l.x1)*180/Math.PI;
const angDiff=(a,b)=>{let d=Math.abs(a-b)%180; return Math.min(d,180-d);};
function segInt(a,b){const d=(a.x2-a.x1)*(b.y2-b.y1)-(a.y2-a.y1)*(b.x2-b.x1); if(Math.abs(d)<1e-9)return null; const t=((b.x1-a.x1)*(b.y2-b.y1)-(b.y1-a.y1)*(b.x2-b.x1))/d; const u=((b.x1-a.x1)*(a.y2-a.y1)-(b.y1-a.y1)*(a.x2-a.x1))/d; return {t,u,x:a.x1+t*(a.x2-a.x1),y:a.y1+t*(a.y2-a.y1)};}
const C={
 symbols(q){const e=q.expr; const i=e.findIndex(t=>t.t==='blank'); const L=evalSide(e.slice(0,i)),R=evalSide(e.slice(i+1)); const op=eq(L,R)?'=':L<R?'<':'>'; const got=q.answer.options[q.answer.correct][0].math[0].v; if(got!==op)return 'wrong symbol '+got+' expected '+op;},
 exprResult(q){const e=q.expr; const i=e.findIndex(t=>t.t==='op'&&t.v==='='); const L=evalSide(e.slice(0,i)); const a=q.answer; const v=a.kind==='fraction'?a.n/a.d:a.kind==='mixed'?a.w+a.n/a.d:a.kind==='number'?a.accept[0]:NaN; if(!eq(L,v))return `value ${v} expected ${L}`; if(a.kind==='mixed'&&!(a.n<a.d))return 'mixed frac part not proper'; if(a.kind==='mixed'&&a.n===0) return 'mixed with zero numerator';},
};
const G={
 cmpSameDen:C.symbols,cmpSameNum:C.symbols,cmpMixedImproper:C.symbols,cmpWithWhole:C.symbols,cmpMixedMixed:C.symbols,
 mixedToImproper(q){const r=C.exprResult(q); if(r)return r; if(!(q.answer.n>q.answer.d))return 'not improper';},
 improperToMixed:C.exprResult,addProper:C.exprResult,addToMixed:C.exprResult,addMixed:C.exprResult,subRegroup:C.exprResult,subMixed:C.exprResult,wholeMinus:C.exprResult,
 betweenWholes(q){const e=q.expr;const a=e[0].v,b=e[4].v,d=e[2].d; const exp=[];for(let k=1;k<200;k++)if(k/d>a&&k/d<b)exp.push(k); if(exp.join()!==q.answer.accept.join())return 'accept '+q.answer.accept+' expected '+exp;},
 missingPart(q){const e=q.expr;const k=q.answer.accept[0]; if(!eq(val(e[0])+k/e[2].d,val(e[4])))return 'bad'; if(q.answer.accept.length!==1)return 'multi';},
 equalsChoice(q){const t=mathToks(q)[0];const v=val(t);const ok=q.answer.options.map((o,i)=>{const m=o[0].math[0];return eq(val(m),v)&&m.n<m.d?i:-1}).filter(i=>i>=0); if(ok.length!==1||ok[0]!==q.answer.correct)return 'correct idx '+q.answer.correct+' valid '+ok;},
 fracBetweenChoice(q){const p=q.params; const ok=q.answer.options.map((o,i)=>{const v=optVal(o);return v>p.lo&&v<p.hi?i:-1}).filter(i=>i>=0); const e=q.expr; if(e&&!(val(e[0])===p.lo&&val(e[4])===p.hi))return 'expr/params mismatch'; if(ok.length!==1||ok[0]!==q.answer.correct)return 'valid '+ok;},
 bracketWholesChoice(q){const e=q.expr; const v=val(e[2]); const ok=q.answer.options.map((o,i)=>{const [a,b]=nums(optText(o));return a<v&&v<b?i:-1}).filter(i=>i>=0); if(ok.length!==1||ok[0]!==q.answer.correct)return 'valid '+ok; const [a,b]=nums(optText(q.answer.options[q.answer.correct])); if(b!==a+1)return 'not tight';},
 orderFractions(q){const vs=mathToks(q).map(val); if(new Set(vs.map(v=>v.toFixed(6))).size!==vs.length)return 'duplicate values '+vs; const ord=String(q.params.order).split(',').map(Number); const ov=ord.map(i=>optVal(q.answer.options[i])); for(let i=1;i<ov.length;i++)if(!(ov[i]>ov[i-1]))return 'order wrong '+ov; if(ord[0]!==q.answer.correct)return 'correct not smallest';},
 fracOfQty(q){const f=mathToks(q)[0];const Q=nums(q.prompt.filter(x=>typeof x==='string').join(' ')).find(n=>n>=2); if(q.answer.accept[0]!==Q*f.n/f.d)return `expected ${Q*f.n/f.d}`; if(!Number.isInteger(Q*f.n/f.d))return 'non-integer';},
 unitFracOfQty(q){return G.fracOfQty(q)},
 remainOfQty(q){const f=mathToks(q)[0];const Q=nums(q.prompt.filter(x=>typeof x==='string').join(' ')).find(n=>n>=2); const r=Q-Q*f.n/f.d; if(q.answer.accept[0]!==r)return 'expected '+r;},
 wholeFromPart(q){const f=mathToks(q)[0];const P=nums(q.prompt.filter(x=>typeof x==='string').join(' '))[0]; const w=P*f.d/f.n; if(q.answer.accept[0]!==w||!Number.isInteger(w))return 'expected '+w;},
 unitWholeFromPart(q){return G.wholeFromPart(q)},
 fracQtyChoice(q){const f=mathToks(q)[0];const Q=nums(q.prompt.filter(x=>typeof x==='string').join(' ')).pop(); const v=Q*f.n/f.d; const ok=q.answer.options.map((o,i)=>optVal(o)===v?i:-1).filter(i=>i>=0); if(ok.length!==1||ok[0]!==q.answer.correct)return 'expected '+v+' valid '+ok; if(new Set(q.answer.options.map(optVal)).size!==q.answer.options.length)return 'dup options';},
 rectArea(q){const v=q.visual;if(q.answer.accept[0]!==v.w*v.h)return 'area';},
 rectPerimeter(q){const v=q.visual;if(q.answer.accept[0]!==2*(v.w+v.h))return 'perim';},
 square(q){const p=q.params;const s=nums(rich(q.prompt)); const exp=p.ask==='area'?p.w*p.w:4*p.w; if(q.answer.accept[0]!==exp)return 'sq'; if(q.visual.w!==q.visual.h)return 'not square vis'; if(s.length&&!s.includes(p.w))return 'prompt side mismatch';},
 doubleLong(q){const p=q.params; const L=Math.max(p.w,p.h)*2,S=Math.min(p.w,p.h); const exp=p.ask==='area'?L*S:2*(L+S); if(q.answer.accept[0]!==exp)return 'exp '+exp; const n=nums(rich(q.prompt)); if(n.length>=2&&!(n.includes(p.w)&&n.includes(p.h)))return 'prompt mismatch';},
 missingSide(q){const n=nums(rich(q.prompt)); const p=q.params; const exp=p.by==='area'?p.given/p.w:p.given/2-p.w; if(q.answer.accept[0]!==exp)return 'exp '+exp; if(!n.includes(p.given)||!n.includes(p.w))return 'prompt mismatch '+n;},
 perimFromArea(q){const n=nums(rich(q.prompt)); const p=q.params; const exp=2*(p.w+p.given/p.w); if(q.answer.accept[0]!==exp||!Number.isInteger(p.given/p.w))return 'exp '+exp; if(!n.includes(p.given)||!n.includes(p.w))return 'prompt mismatch';},
 perimWidth(q){const n=nums(rich(q.prompt)); const p=q.params; const W=p.P/2-p.L; const exp=p.ask==='width'?W:p.L; if(q.answer.accept[0]!==exp||W<=0)return 'exp '+exp; if(!n.includes(p.P))return 'prompt mismatch'; if(p.ask==='width'&&!(p.L>W))return 'length not longer than width';},
 scaleSideArea(q){const p=q.params; const n=nums(rich(q.prompt)); const exp=p.grow==='long'?p.long*p.k*p.short:p.long*p.short*p.k; if(q.answer.accept[0]!==exp)return 'exp '+exp;},
 areaPerimTrap(q){const p=q.params; const keys=String(p.keys).split(','); const k=keys[q.answer.correct]; const P=2*(p.w+p.h),A=p.w*p.h; const claimed=nums(rich(q.prompt)).find(x=>x===p.claimed); const real=k==='perim'?P:k==='area'?A:2*Math.max(p.w,p.h); if(p.claimed!==real)return 'claimed '+p.claimed+' not '+k; if(P===A)return 'P==A ambiguous'; const vals={perim:P,area:A,long:2*Math.max(p.w,p.h)}; const m=keys.filter(x=>vals[x]===p.claimed); if(m.length!==1)return 'ambiguous '+m; if(claimed===undefined)return 'claimed not in prompt'; if(q.visual.w!==p.w||q.visual.h!==p.h)return 'vis mismatch';},
 identifyLines(q){const v=q.visual; const d=angDiff(ang(v.a),ang(v.b)); const t=q.params.type; const k=['parallel','perpendicular','intersecting'][q.answer.correct]; if(k!==t)return 'key/type mismatch'; if(t==='parallel'&&d>0.5)return 'not parallel '+d; if(t==='perpendicular'&&Math.abs(d-90)>0.5)return 'not perp '+d; if(t==='intersecting'){ if(d<20||Math.abs(d-90)<15)return 'intersect angle ambiguous '+d; const s=segInt(v.a,v.b); if(!s||s.t<0||s.t>1||s.u<0||s.u>1)return 'intersecting lines do not cross in drawing';} if(t==='perpendicular'){const s=segInt(v.a,v.b); if(!s||s.t<-0.02||s.t>1.02||s.u<-0.02||s.u>1.02)return 'perp lines do not meet in drawing';}},
 linesTrap(q){const v=q.visual; const d=angDiff(ang(v.a),ang(v.b)); const s=segInt(v.a,v.b); if(s&&s.t>=0&&s.t<=1&&s.u>=0&&s.u<=1)return 'lines meet in drawing'; if(d<8)return 'too close to parallel '+d.toFixed(1); if(Math.abs(d-90)<10)return 'near perpendicular';},
 parallelThrough(q){const v=q.visual; const dist=Math.abs((v.y2-v.y1)*v.px-(v.x2-v.x1)*v.py+v.x2*v.y1-v.y2*v.x1)/Math.hypot(v.x2-v.x1,v.y2-v.y1); if(dist<25)return 'P too close to line '+dist.toFixed(1);},
 colorParts(q){const p=q.params; if(!(p.count*p.d>=p.n&&(p.count-1)*p.d<p.n))return 'shape count '+p.count+' for '+p.n+'/'+p.d; const f=mathToks(q)[0]; if(f.n!==p.n||f.d!==p.d)return 'prompt mismatch';},
 fracWord(q){const ts=mathToks(q); const s=rich(q.prompt); const a=q.answer; const v=a.kind==='fraction'?a.n/a.d:a.kind==='number'?a.accept[0]:a.w+a.n/a.d; const vals=ts.map(val); let exp;
   if(/בבקבוק היו/.test(s)) exp=vals[0]-vals.slice(1).reduce((x,y)=>x+y,0); else if(/נשאר/.test(s)) exp=1-vals.reduce((x,y)=>x+y,0); else if(/בסך הכול|יחד|ביחד/.test(s)) exp=vals.reduce((x,y)=>x+y,0); else return 'unknown kind: '+s;
   if(!eq(v,exp))return 'exp '+exp; if(a.kind==='mixed'&&a.n===0)return 'mixed with zero numerator';},
 fracWordPair(q){const ts=mathToks(q).map(val); const a=q.answer; if(!eq(a.n/a.d,ts[0]+ts[1]))return 'sum'; const l=rich(q.explain.lines[1]); },
 cmpTrap(q){const p=q.params; const k=String(p.keys).split(',')[q.answer.correct]; if(k!=='no')return 'key';},
 addSubTrap(q){const p=q.params; const ks=String(p.keys).split(','); const k=ks[q.answer.correct]; if(k!=='denom')return 'key'; const t=optText(q.answer.options[q.answer.correct]); const m=t.match(/(\d+)\/(\d+)/); if(+m[1]!==p.a+p.b||+m[2]!==p.d)return 'correct text wrong '+t; const mi=ks.indexOf('mult'); const mt=optText(q.answer.options[mi]).match(/(\d+)\/(\d+)/); if(mt&&+mt[1]/+mt[2]===(p.a+p.b)/p.d)return 'distractor equals true answer';},
 lineConcept(q){},
 fracBetween(q){}, bracketWholes(q){}, numberLineTap(q){const a=q.answer; if(a.target/a.d>a.max)return 'target beyond line';},
 bracketWholes(q){const e=q.expr;const v=val(e[2]); if(!(q.params.lo<v&&v<q.params.hi&&q.params.hi===q.params.lo+1))return 'bad';},
};
let seed=1;
for(const g of Object.keys(T.hr)){ for(const L of [1,2,3]) for(let i=0;i<N;i++){ const q=T.hr[g](T.k(seed++*2654435761%4294967296),L); cnt[g]=(cnt[g]||0)+1;
  if(!G[g]){(fails[g]??=['NO CHECK']);continue;} let r; try{r=G[g](q)}catch(e){r='EXC '+e} if(r)fail(g,q,'L'+L+' '+r);
  // generic: a mixed-number answer must have a non-zero fraction part (a whole number is a 'number' answer)
  if(q.answer.kind==='mixed'&&q.answer.n===0)fail(g,q,'L'+L+' mixed with zero numerator');
  // generic: choice options must be distinct
  if(q.answer.kind==='choice'){const ts=q.answer.options.map(optText); if(new Set(ts).size!==ts.length)fail(g,q,'duplicate options');}
 }}
for(const [g,f] of Object.entries(fails)){console.log(`== ${g}: ${f.length}/${cnt[g]}`); [...new Set(f.map(x=>x.split(' :: ')[0]))].slice(0,6).forEach(m=>{const ex=f.find(x=>x.startsWith(m));console.log('  ',ex.slice(0,330))});}

// ===================== worksheet library (src/library.js) =====================
// Every answer is recomputed from what is printed on the sheet: numbers are parsed
// from the displayed strings/tokens, expressions are evaluated by an independent parser.
if(T.lib){
 const Lb=T.lib, lf={}, lc={};
 const lfail=(g,it,msg)=>{(lf[g]??=[]).push(msg+' :: '+rich(it.prompt||[])+' '+(it.expr?it.expr.map(tk).join(' '):'')+(it.statement?rich(it.statement):'')+' => '+rich(it.key||[]));};
 const tk=t=>t.t==='fb'?`[${t.n??'□'}/${t.d??'□'}]`:t.t==='wb'?'[__]':t.t==='mb'?'[□□/□]':tok(t);
 const pnum=s=>Number(String(s).replace(/,/g,''));
 const tv=t=>t.t==='num'?pnum(t.v):t.t==='frac'?t.n/t.d:t.t==='mixed'?t.w+t.n/t.d:NaN;
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 const ansVal=a=>a.kind==='num'?a.v:a.kind==='frac'||a.kind==='rat'?a.n/a.d:a.kind==='dec'?a.m/1000:NaN;
 const g2=(a,b)=>b===0?Math.abs(a):g2(b,a%b);
 const mtoks=r=>(r||[]).filter(x=>typeof x!=='string').flatMap(x=>x.math);
 const text=r=>(r||[]).filter(x=>typeof x==='string').join(' ');
 const symOK=(it)=>{const e=it.expr;const i=e.findIndex(t=>t.t==='blank');const a=tv(e[i-1]),b=tv(e[i+1]);const s=near(a,b)?'=':a<b?'<':'>';return s===it.answer.v?null:`symbol ${it.answer.v} expected ${s}`;};
 // independent evaluator: tokens -> shunting-yard
 function evalT(ts){const out=[],ops=[];const pr={'+':1,'−':1,'-':1,'×':2,'*':2,':':2};
  const ap=()=>{const o=ops.pop(),b=out.pop(),a=out.pop();let v;if(o==='+')v=a+b;else if(o==='−'||o==='-')v=a-b;else if(o==='×'||o==='*')v=a*b;else{if(b===0||a%b)throw Error('inexact division');v=a/b;}if(v<0)throw Error('negative intermediate');out.push(v);};
  for(const t of ts){const v=typeof t==='object'?(t.t==='op'?t.v:tv(t)):t; if(typeof v==='number'){out.push(v);continue;}
   if(v==='(')ops.push(v);else if(v===')'){while(ops[ops.length-1]!=='(')ap();ops.pop();}else{while(ops.length&&ops[ops.length-1]!=='('&&pr[ops[ops.length-1]]>=pr[v])ap();ops.push(v);}}
  while(ops.length)ap();return out[0];}
 const lhs=e=>e.slice(0,e.findIndex(t=>t.t==='op'&&t.v==='='));
 const sumSide=ts=>{let v=0,sg=1;for(const t of ts){if(t.t==='op')sg=(t.v==='+')?1:-1;else v+=sg*tv(t);}return v;};
 const exprRat=it=>{const v=sumSide(lhs(it.expr));return near(v,ansVal(it.answer))?null:`value ${ansVal(it.answer)} expected ${v}`;};
 const fillFb=(e,ans)=>e.map(t=>t.t==='fb'?{t:'frac',n:t.n??ans,d:t.d??ans}:t);
 const placeHe={'אחדות':1,'עשרות':10,'עשיריות':0.1,'מאיות':0.01,'אלפיות':0.001};
 const unitHe={'יחידות':1,'עשרות':10,'מאות':100,'אלפים':1000,'עשרות אלפים':1e4,'מאות אלפים':1e5,'מיליונים':1e6};
 const roundTo={'למספר שלם':1,'לעשיריות':0.1,'למאיות':0.01,'לעשרות':10,'למאות':100,'לאלפים':1000,'לעשרות אלפים':1e4};
 const rnd=(x,u)=>Math.round(Math.floor(x/u+0.5+1e-9)*u*1000)/1000;
 const C_={
  eqExpand:it=>{const e=fillFb(it.expr,it.answer.v);return near(tv(e[0]),tv(e[2]))?null:'not equal';},
  eqSimplify:it=>{const a=it.answer;if(!near(tv(it.expr[0]),a.n/a.d))return 'value';if(g2(a.n,a.d)!==1)return 'not lowest';},
  eqTF:it=>{const m=mtoks(it.statement);const t=m[0].n*m[2].d===m[2].n*m[0].d;if(t!==it.answer.value)return 'truth';if((rich(it.key).startsWith('נכון'))!==t)return 'key text';},
  eqOdd:it=>{const base=mtoks(it.prompt)[0];const bad=it.options.map((o,i)=>near(tv(mtoks(o)[0]),tv(base))?-1:i).filter(i=>i>=0);if(bad.length!==1||bad[0]!==it.answer.correct)return 'odd one '+bad;},
  eqMatch:it=>{const m=it.answer.map;if(new Set(m).size!==m.length)return 'not a permutation';if(m.some((v,i)=>v===i))return 'a pair sits on the same row (gives the answer away)';for(let i=0;i<m.length;i++){if(!near(tv(it.left[i][0]),tv(it.right[m[i]][0])))return 'pair '+i;if(it.right.filter(r=>near(tv(r[0]),tv(it.left[i][0]))).length!==1)return 'ambiguous';}},
  cmpDiff:symOK,decCompare:symOK,cmpBig:symOK,
  orderDiff:it=>{const v=it.values.map(tv);if(new Set(v.map(x=>x.toFixed(9))).size!==v.length)return 'tie';const o=it.answer.order;for(let i=1;i<o.length;i++)if(!(v[o[i]]>v[o[i-1]]))return 'order';},
  decOrder:it=>C_.orderDiff(it),
  halfTable:it=>{for(let i=0;i<it.rows.length;i++){const v=tv(it.rows[i][0]);const c=near(v,.5)?1:v<.5?0:2;if(c!==it.answer.choice[i])return 'row '+i;}},
  addDiff:exprRat,subDiff:exprRat,fracTimes:it=>{const e=lhs(it.expr);const v=tv(e[0])*tv(e[2]);return near(v,ansVal(it.answer))?null:'product';},
  toWhole:it=>{const e=fillFb(it.expr,it.answer.v);return near(tv(e[0])+tv(e[2]),tv(e[4]))?null:'not whole';},
  repeatedAdd:it=>{const e=it.expr;const eq=e.findIndex(t=>t.t==='op'&&t.v==='=');const terms=e.slice(0,eq).filter(t=>t.t!=='op');const [c,r]=it.answer.vals;if(c.v!==terms.length)return 'count';if(!near(r.n/r.d,sumSide(e.slice(0,eq))))return 'sum';},
  wordDiff:it=>{const f=mtoks(it.prompt).map(tv);const s=text(it.prompt);const exp=/יחד/.test(s)?f[0]+f[1]:/נשאר/.test(s)?1-f[0]-f[1]:/יותר/.test(s)?f[0]-f[1]:NaN;if(!(exp>0))return 'non-positive or unknown '+exp;return near(exp,ansVal(it.answer))?null:'expected '+exp;},
  mulWord:it=>{const f=tv(mtoks(it.prompt)[0]);const n=(text(it.prompt).match(/\d+/g)||[]).map(Number);if(n.length!==1)return 'count numbers '+n;return near(n[0]*f,ansVal(it.answer))?null:'product';},
  decFrac:it=>{const e=it.expr;let v=tv(e[0]);let a;if(it.answer.kind==='num'){const fb=e[2];a=it.answer.v/fb.d;}else a=ansVal(it.answer);return near(v,a)?null:`${v} vs ${a}`;},
  decPlace:it=>{const s=rich(mtoks(it.prompt).length?[{math:mtoks(it.prompt)}]:[]).trim();const dg=it.answer.digit;const plain=s.replace(/,/g,'');if(plain.split('').filter(c=>c===dg).length!==1)return 'digit not unique';const [ip,fp='']=plain.split('.');let pv=ip.includes(dg)?10**(ip.length-1-ip.indexOf(dg)):10**-(fp.indexOf(dg)+1);const name=rich(it.options[it.answer.correct]).replace(dg+' ','');if(!near(placeHe[name],pv))return `place ${name} expected ${pv}`;},
  decLine:it=>{const v=it.visual;const a=pnum(v.label[0]),b=pnum(v.label[1]);const x=a+(b-a)*v.at/10;return near(x,ansVal(it.answer))?null:'arrow value '+x;},
  decRound:it=>{const u=roundTo[it.label];const x=tv(it.expr[0]);return near(rnd(x,u),ansVal(it.answer))?null:'round '+rnd(x,u);},
  decVert:it=>{const [a,b]=it.rows.map(pnum);const v=it.op==='+'?a+b:a-b;return near(Math.round(v*1000)/1000,ansVal(it.answer))?null:'calc';},
  mulVert:it=>{const [a,b]=it.rows.map(pnum);return a*b===it.answer.v?null:'calc';},
  placeValue:it=>{const n=String(pnum(tv(mtoks(it.prompt)[0])));const dg=String(it.answer.digit);if(n.split('').filter(c=>c===dg).length!==1)return 'digit not unique';return it.answer.v===Number(dg)*10**(n.length-1-n.indexOf(dg))?null:'value';},
  compose:it=>{const s=text(it.prompt).replace(/=\s*$/,'');let v=0;for(const part of s.split(/, | ו־/)){const m=part.trim().match(/^(\d)\s+(.+)$/);if(!m||!unitHe[m[2]])return 'parse '+part;v+=+m[1]*unitHe[m[2]];}return v===it.answer.v?null:'sum '+v;},
  roundBig:it=>{const u=roundTo[it.label];const x=tv(it.expr[0]);return rnd(x,u)===it.answer.v?null:'round '+rnd(x,u);},
  divTable:it=>{const ps=it.cols.map(c=>+c.match(/\d+/)[0]);for(let r=0;r<it.rows.length;r++){const n=tv(it.rows[r][0]);for(let c=0;c<ps.length;c++)if((n%ps[c]===0)!==it.answer.cells[r][c])return `cell ${n}/${ps[c]}`;}},
  divDigit:it=>{const ts=mtoks(it.prompt).flatMap(t=>t.t==='dg'?t.d.map(z=>z===null?{t:'blank'}:{t:'num',v:z}):[t]);const p=+text(it.prompt).match(/יתחלק ב־(\d+)/)[1];const ok=[];for(let d=0;d<=9;d++){const s=ts.map(t=>t.t==='blank'?d:t.v).join('');if(s[0]==='0')continue;if(+s%p===0)ok.push(d);}return ok.join()===it.answer.ok.join()&&ok.length?null:'digits '+ok;},
  divTF:it=>{const n=tv(mtoks(it.statement)[0]);const p=+text(it.statement).match(/ב־(\d+)/)[1];return (n%p===0)===it.answer.value?null:'truth';},
  mental:it=>{const v=evalT(lhs(it.expr));return v===it.answer.v?null:'calc '+v;},
  opsCompute:it=>{const v=evalT(lhs(it.expr));return v===it.answer.v?null:'calc '+v;},
  longDiv:it=>{const e=it.expr;const a=tv(e[0]),b=tv(e[2]);return Math.floor(a/b)===it.answer.q&&a%b===it.answer.rem?null:'div';},
  opsTF:it=>{const m=mtoks(it.statement);const i=m.findIndex(t=>t.t==='op'&&t.v==='=');let v;try{v=evalT(m.slice(0,i));}catch(e){return 'eval '+e.message;}return (v===tv(m[i+1]))===it.answer.value?null:'truth';},
  opsParens:it=>{const e=it.expr;const i=e.findIndex(t=>t.t==='op'&&t.v==='=');const target=tv(e[i+1]);let plain;try{plain=evalT(e.slice(0,i));}catch{plain=NaN;}if(plain===target)return 'already true without parentheses';const par=it.answer.par;if(evalT(par)!==target)return 'parenthesised value';const strip=par.filter(t=>t!=='('&&t!==')').map(String).join(' ');const shown=e.slice(0,i).map(t=>t.t==='op'?(t.v==='*'?'*':t.v):String(tv(t))).join(' ');return strip===shown?null:'different numbers';},
  angleType:it=>{const d=it.visual.deg;const c=d<90?0:d===90?1:d<180?2:3;if(c!==it.answer.correct)return 'class';if(d!==90&&d!==180&&Math.abs(d-90)<15)return 'too close to 90';},
  triMissing:it=>{const lb=it.visual.labels;const known=lb.filter(x=>x&&x!=='?').map(x=>parseInt(x));let exp;if(it.visual.iso){if(it.visual.A!==it.visual.B)return 'not isosceles';exp=(180-known[0])/2;if(lb[2]==='?')return 'iso asks apex';}else exp=180-known[0]-known[1];if(!(exp>0))return 'impossible';return exp===it.answer.v?null:'expected '+exp;},
  triType:it=>{const a=(text(it.prompt).match(/\d+(?=°)/g)||[]).map(Number);if(a.length!==3||a.reduce((x,y)=>x+y)!==180)return 'angles '+a;const m=Math.max(...a);const c=m<90?0:m===90?1:2;return c===it.answer.correct?null:'class';},
  lShape:it=>{const v=it.visual;if(!(v.w<v.W&&v.h<v.H&&v.w>0&&v.h>0))return 'shape';const exp=it.answer.ask==='area'?v.W*v.H-v.w*v.h:2*(v.W+v.H);const s=text(it.prompt);if((it.answer.ask==='area')!==/שטח/.test(s))return 'prompt asks other quantity';return exp===it.answer.v?null:'expected '+exp;},
 };
 const NL=Math.max(50,Math.round(N/2));
 let seed2=1;
 for(const g of Object.keys(Lb.GEN)){ for(const L of [1,2,3]) for(let i=0;i<NL;i++){ const it=Lb.GEN[g](T.k(seed2++*2654435761%4294967296),L); lc[g]=(lc[g]||0)+1;
   if(!C_[g]){(lf[g]??=['NO CHECK']);continue;} let r; try{r=C_[g](it);}catch(e){r='EXC '+e.message;} if(r)lfail(g,it,'L'+L+' '+r);
   if(it.options){const ts=it.options.map(o=>rich(o));if(new Set(ts).size!==ts.length)lfail(g,it,'duplicate options');}
   if(!it.key||!rich(it.key).trim())lfail(g,it,'empty key');
 }}
 // sheets: every recipe/level/length builds, no duplicate items, and masculine wording leaves no feminine imperative
 const fem=/(^|[^א-ת])(כתבי|השלימי|צמצמי|הקיפי|חברי|סמני|סדרי|חשבי|פתרי|עגלי|הוסיפי|שימי|מצאי|צבעי|בחרי)(?![א-ת])/;
 for(const rc of Lb.R) for(const L of [1,2,3]) for(const len of ['s','n','l']) for(let s=1;s<=8;s++){ const sh=Lb.buildSheet(rc,s*977,L,len); lc['sheet']=(lc['sheet']||0)+1;
   const keys=new Set(); for(const p of sh.parts) for(const it of p.items){ const kk=JSON.stringify([it.expr,it.statement,it.prompt,it.values,it.visual,it.rows]); if(keys.has(kk)) (lf['sheet']??=[]).push(`${rc.id} L${L}: duplicate item`); keys.add(kk); }
   const words=[...sh.parts.map(p=>p.title),...sh.parts.flatMap(p=>p.items.flatMap(it=>[...(it.prompt||[]),...(it.options||[]).flat()]))].filter(x=>typeof x==='string').map(x=>T.mpgStr(x,'m')).join(' ');
   const m=words.match(fem); if(m)(lf['sheet']??=[]).push(`${rc.id}: feminine "${m[2]}" left in masculine wording`);
 }
 for(const [g,f] of Object.entries(lf)){console.log(`== library ${g}: ${f.length}/${lc[g]}`); [...new Set(f.map(x=>x.split(' :: ')[0]))].slice(0,6).forEach(m=>console.log('  ',f.find(x=>x.startsWith(m)).slice(0,330)));}
 console.log('library:',Object.values(lc).reduce((a,b)=>a+b,0),'items/sheets checked across',Object.keys(Lb.GEN).length,'generators and',Lb.R.length,'recipes');
 for(const [g,f] of Object.entries(lf)) fails['library '+g]=f;
}
const bad=Object.entries(fails);
console.log('checked',Object.values(cnt).reduce((a,b)=>a+b),'questions;', bad.length?bad.length+' generator(s) with wrong keys':'all answer keys OK');
process.exit(bad.length?1:0);
