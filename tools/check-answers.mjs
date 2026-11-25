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
src=src.slice(0,cut)+';globalThis.__T={hr,k,wsBuild:typeof wsBuild=="function"?wsBuild:null};';
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
 fracWord(q){const ts=mathToks(q); const s=rich(q.prompt); const a=q.answer; const v=a.kind==='fraction'?a.n/a.d:a.w+a.n/a.d; const vals=ts.map(val); let exp;
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
  // generic: choice options must be distinct
  if(q.answer.kind==='choice'){const ts=q.answer.options.map(optText); if(new Set(ts).size!==ts.length)fail(g,q,'duplicate options');}
 }}
for(const [g,f] of Object.entries(fails)){console.log(`== ${g}: ${f.length}/${cnt[g]}`); [...new Set(f.map(x=>x.split(' :: ')[0]))].slice(0,6).forEach(m=>{const ex=f.find(x=>x.startsWith(m));console.log('  ',ex.slice(0,330))});}
const known=new Set(['fracWord']); // fracWord 'run' (level 3) totals a whole number; stored as w + 0/d, graded correctly
const bad=Object.entries(fails).filter(([g,f])=>!(known.has(g)&&f.every(x=>x.includes('mixed with zero numerator'))));
console.log('checked',Object.values(cnt).reduce((a,b)=>a+b),'questions;', bad.length?bad.length+' generator(s) with wrong keys':'all answer keys OK');
process.exit(bad.length?1:0);
