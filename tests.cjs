// node tests.cjs — checks the decision tree, the teaching content and the calculator core in index.html
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const block=(a,b)=>html.slice(html.indexOf(a)+a.length,html.indexOf(b));
const ctx={}; vm.createContext(ctx);
vm.runInContext(block("/*ENGINE-START*/","/*ENGINE-END*/")+block("/*CASES-START*/","/*CASES-END*/")+block("/*TEACH-START*/","/*TEACH-END*/")
  +";this.TREE=TREE;this.HK=HK;this.CASES=CASES;this.DEMOS=DEMOS;this.MAP=MAP;this.pathTo=pathTo;this.shortLabel=shortLabel;",ctx);
const {TREE,HK,CASES,DEMOS,MAP,pathTo,shortLabel}=ctx;
let n=0,fail=0;
function ok(c,msg){n++; if(!c){fail++;console.log("FAIL",msg)}}
function near(a,b,msg,t=0.01){ok(a!==null&&Math.abs(a-b)<=t,msg+" got "+a+" want "+b)}

// tree integrity
for(const [id,nd] of Object.entries(TREE)){
  (nd.opts||[]).forEach(o=>ok(TREE[o.go],id+" → missing "+o.go));
  if(nd.next) ok(TREE[nd.next.go],id+" next → missing "+nd.next.go);
  ok(nd.type==="q"?nd.opts&&nd.opts.length>=2:nd.type==="end",id+" shape");
  ok(pathTo(id),id+" unreachable from root");
}
ok(pathTo("end_rta").join(">")==="start>pseudo>intake>shift>urinek>high_ab>high_acid_nh4>end_rta","pathTo end_rta");
// labels: entities decoded, Latin dropped
ok(shortLabel("低 &lt; 10–20 mmol/L")==="低 < 10–20","shortLabel entity "+shortLabel("低 &lt; 10–20 mmol/L"));
ok(shortLabel("是 Yes — 有上述任一項")==="是","shortLabel yes");
// Ca/Cr cut-offs use different units: a short label must not show bare numbers
TREE.uca.opts.forEach(o=>ok(o.e&&!/\d/.test(shortLabel(o.e)),"uca short label has no bare number: "+o.l));
// retired values must not come back
["1–3 mg/kg","每次 10 mmol","約 0.3 mmol/L）","Sterns"].forEach(s=>ok(!html.includes(s),"stale text: "+s));

// quiz bank
ok(CASES.length===20,"20 questions, got "+CASES.length);
[[1,6],[2,7],[3,7]].forEach(([l,c])=>ok(CASES.filter(q=>q.lv===l).length===c,"level "+l+" count"));
const pos=[0,0,0,0];
CASES.forEach((c,i)=>{
  const q="Q"+(i+1);
  ok(c.a>=0&&c.a<c.opts.length&&c.labs.length,q+" shape");
  ok(c.opts.length===4,q+" has 4 options");
  ok(new Set(c.opts).size===c.opts.length,q+" duplicate option");
  ok(TREE[c.node],q+" node "+c.node);
  ok(c.path&&c.ex&&c.story,q+" text");
  pos[c.a]++;
  if(c.check&&c.check.x){
    const r=HK.calc(c.check.x), k=c.check;
    if(k.route) ok(r.route===k.route,q+" route "+r.route+" want "+k.route);
    if(k.ag!==undefined) near(r.ag,k.ag,q+" AG");
    if(k.kcr!==undefined) near(r.kcr,k.kcr,q+" K/Cr");
    if(k.cacrClass) ok(r.cacrClass===k.cacrClass,q+" Ca/Cr class "+r.cacrClass);
    if(k.cacrMg!==undefined) near(r.cacrMg,k.cacrMg,q+" Ca/Cr mg/mg",0.002);
    if(k.uclClass) ok(r.uclClass===k.uclClass,q+" UCl class");
  }
  if(c.check&&c.check.edelman){const e=c.check.edelman; near(e.k/e.tbw,e.rise,q+" Edelman");}
});
pos.forEach((c,i)=>ok(c>=3&&c<=7,"answer position "+i+" used "+c+" times"));
ok(new Set(CASES.map(c=>c.story)).size===20,"duplicate stems");

// worked cases: tree walk is legal, calculator agrees, and the stated arithmetic matches
ok(DEMOS.length===6,"6 demos");
const fromPage=v=>{const x={...v}; if(x.pcr!==undefined)x.pcr/=HK.CR_MGDL_PER_MMOL; if(x.ucr!==undefined)x.ucr/=HK.CR_MGDL_PER_MMOL; if(x.uca!==undefined)x.uca/=HK.CA_MGDL_PER_MMOL; return x};
const allNull={pk:null,pcr:null,posm:null,sna:null,scl:null,shco3:null,alb:null,uk:null,ucr:null,uosm:null,una:null,ucl:null,uurea:null,uglu:null,uca:null,u24:null};
DEMOS.forEach(d=>{
  const q=d.id;
  ok(d.steps[0].n==="start",q+" starts at root");
  d.steps.forEach((s,i)=>{
    const nd=TREE[s.n]; ok(nd,q+" step node "+s.n);
    const legal=(nd.opts||[]).some(o=>o.go===s.to)||(nd.next&&nd.next.go===s.to);
    ok(legal,q+" illegal move "+s.n+"→"+s.to);
    const next=i+1<d.steps.length?d.steps[i+1].n:d.end;
    ok(s.to===next,q+" chain "+s.to+"≠"+next);
    ok(s.why,q+" reason");
  });
  ok(TREE[d.end]&&TREE[d.end].type==="end",q+" end");
  const r=HK.calc({...allNull,...fromPage(d.input)});
  ok(r.route===d.route,q+" calculator route "+r.route+" want "+d.route);
  ok(r.warn.length===0,q+" unit warnings "+r.warn.join());
  ok(!r.conflict,q+" indices conflict");
  ok(d.input.pk<3.5,q+" hypokalemic");
  // every lab chip value that is also an input must match it
  [["K⁺","pk"],["Na⁺","sna"],["Cl⁻","scl"],["HCO₃⁻","shco3"],["Urine K⁺","uk"],["Urine Na⁺","una"],["Urine Cl⁻","ucl"],["Urine Cr","ucr"],["Urine Ca","uca"],["Cr","pcr"],["Urine urea","uurea"]].forEach(([k,f])=>{
    const chip=d.labs.find(l=>l.startsWith(k+" ")); if(chip) ok(parseFloat(chip.slice(k.length+1))===d.input[f],q+" chip "+chip+" vs "+f+"="+d.input[f]);
  });
  ok(d.tx.length>=3&&d.pit,q+" teaching");
});
const D=id=>{const d=DEMOS.find(x=>x.id===id);return HK.calc({...allNull,...fromPage(d.input)})};
near(D("d1").kcr,7.27,"d1 K/Cr"); near(D("d1").cacrMg,0.243,"d1 Ca/Cr",0.002); ok(D("d1").cacrClass==="high","d1 high Ca");
near(D("d2").kcr,1.23,"d2 K/Cr"); ok(D("d2").excretion.c==="low","d2 low");
near(D("d3").kcr,5.28,"d3 K/Cr"); near(D("d3").ag,10,"d3 AG"); near(D("d3").uog,50,"d3 UOG"); ok(D("d3").uogClass==="low","d3 UOG low");
near(D("d4").kcr,9.55,"d4 K/Cr"); near(D("d4").cacr,0.188,"d4 Ca/Cr mmol",0.002); ok(D("d4").cacrClass==="low","d4 low Ca");
near(40/22.5,1.8,"d4 40 mmol",0.03); near(120/22.5,5.3,"d4 120 mmol",0.04);
near(D("d5").kcr,5.24,"d5 K/Cr");
near(D("d6").kcr,6.79,"d6 K/Cr"); ok(D("d6").uclClass==="low","d6 UCl low");
// ladder in the Ca/Cr quiz: 0.15 mg/mg ≈ 0.42 mmol/mmol
near(0.15*113.12/40.08,0.423,"mg/mg → mmol/mmol",0.002);

// mind map links
ok(MAP.length>=8,"map branches");
MAP.forEach(b=>{
  ok(b.go?TREE[b.go]:b.tab,"map branch target "+b.t);
  b.i.forEach(l=>ok(l.go?TREE[l.go]:l.tab,"map leaf target "+l.t));
});
const TABS=[...html.matchAll(/data-tab="(\w+)"/g)].map(m=>m[1]);
["dx","calc","chart","tx","labs","demo","quiz","map"].forEach(t=>{ok(TABS.includes(t),"tab "+t);ok(html.includes('id="tab-'+t+'"'),"panel "+t)});
MAP.forEach(b=>b.i.forEach(l=>{if(l.tab)ok(TABS.includes(l.tab),"map tab "+l.tab)}));

// calculator
const base={pk:2.8,pcr:0.9/11.312,posm:290,sna:140,scl:100,shco3:30,alb:null,uk:40,ucr:80/11.312,uosm:600,una:60,ucl:50,uurea:200,uglu:null,uca:null,u24:null};
let r=HK.calc(base);
near(r.kcr,40/(80/11.312),"K/Cr");
near(r.ttkg,(40/2.8)/(600/290),"TTKG");
near(r.fek,40*0.9/(2.8*80)*100,"FEK");
near(r.uog,600-(2*100+200),"UOG");
near(r.ag,10,"AG");
ok(r.excretion.c==="high"&&r.excretion.by==="Urine K/Cr","renal by K/Cr");
ok(r.ab==="alk"&&r.route==="high_alk_bp","route alkalosis");
// missing urea must not fake an osmolar gap
ok(HK.calc({...base,uurea:null}).uog===null,"UOG needs urea");
// glucose optional
near(HK.calc({...base,uglu:20}).uog,180,"UOG glucose");
// albumin correction
near(HK.calc({...base,alb:2}).agc,15,"AG corrected");
// deficit is a range, 200–400 per mmol/L below 4
r=HK.calc({...base,pk:3}); near(r.deficitLow,200,"deficit low 3"); near(r.deficitHigh,400,"deficit high 3");
r=HK.calc({...base,pk:2}); near(r.deficitLow,400,"deficit low 2"); near(r.deficitHigh,800,"deficit high 2");
ok(HK.calc({...base,pk:4.2}).deficitHigh===0,"deficit 0"); ok(HK.calc({...base,pk:null}).deficitLow===null,"deficit missing");
// gray zone K/Cr falls through to TTKG
r=HK.calc({...base,uk:12,ucr:7,uosm:600,posm:290,pk:2.8}); // K/Cr 1.71 gray, TTKG 2.07 low
ok(r.excretion.c==="low"&&r.excretion.by==="TTKG","gray K/Cr → TTKG");
// invalid TTKG ignored
r=HK.calc({...base,ucr:null,uosm:250}); ok(!r.ttkgValid&&r.excretion===null,"invalid TTKG ignored");
// 24h: priority, conflict, and the 15–30 gray zone
r=HK.calc({...base,u24:9}); ok(r.excretion.c==="low"&&r.conflict,"24h priority + conflict");
ok(HK.calc({...base,u24:40}).excretion.by==="24h 尿鉀","24h high");
r=HK.calc({...base,u24:20}); ok(r.excretion.by==="Urine K/Cr","24h gray falls through");
r=HK.calc({...base,u24:20,uk:null}); ok(r.excretion.c==="gray","24h gray alone");
ok(HK.calc({...base,u24:15}).excretion.by!=="24h 尿鉀"&&HK.calc({...base,u24:30}).excretion.by!=="24h 尿鉀","24h boundaries gray");
// acidosis routes
const acid={...base,shco3:14,scl:115};
ok(HK.calc({...acid,uosm:420}).route==="end_rta","RTA: UOG 20");
ok(HK.calc({...acid,uosm:600}).route==="end_acid_highnh4","high NH4: UOG 200");
ok(HK.calc({...acid,uosm:525}).route==="high_acid_nh4","UOG 125 gray");
ok(HK.calc({...acid,uk:5,u24:8}).route==="end_low_acidosis","low K + acidosis");
ok(HK.calc({...base,shco3:24}).route==="end_nonreab","renal + normal");
ok(HK.calc({...base,uk:null,shco3:null}).route==="urinek","no data");
// Ca/Cr: Gitelman 0.06 mg/mg = 0.17 mmol/mmol; Bartter 0.3 mg/mg
const ucrMmol=80/11.312;
r=HK.calc({...base,uca:0.17*ucrMmol}); ok(r.cacrClass==="low","Ca/Cr low"); near(r.cacrMg,0.06,"Ca/Cr mg/mg",0.002);
ok(HK.calc({...base,uca:0.85*ucrMmol}).cacrClass==="high","Ca/Cr high");
ok(HK.calc({...base,uca:0.35*ucrMmol}).cacrClass==="gray","Ca/Cr gray");
// unit guards: 80 typed with the mmol/L unit selected
ok(HK.calc({...base,ucr:80}).warn.length===1,"urine Cr unit warning");
ok(HK.calc({...base,pcr:0.9}).warn.length===0,"plasma Cr 0.9 mmol/L is not flagged"+"");
ok(HK.calc({...base,pcr:3}).warn.length===1,"plasma Cr unit warning");
ok(HK.calc({...base,pk:28}).warn.length===1,"K typo warning");
ok(HK.calc(base).warn.length===0,"no warnings on defaults");

console.log(fail?fail+" / "+n+" failed":"all "+n+" checks passed");
process.exit(fail?1:0);
