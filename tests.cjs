// node tests.cjs — checks the decision tree, the cases and the calculator core in index.html
const fs=require("fs"), vm=require("vm");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const block=(a,b)=>html.slice(html.indexOf(a)+a.length,html.indexOf(b));
const ctx={}; vm.createContext(ctx);
vm.runInContext(block("/*ENGINE-START*/","/*ENGINE-END*/")+block("/*CASES-START*/","/*CASES-END*/")
  +";this.TREE=TREE;this.HK=HK;this.CASES=CASES;this.pathTo=pathTo;this.shortLabel=shortLabel;",ctx);
const {TREE,HK,CASES,pathTo,shortLabel}=ctx;
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
ok(shortLabel("尿鈣高 ＞0.20 mg/mg")==="尿鈣高 ＞0.20","shortLabel cacr");

// cases
CASES.forEach((c,i)=>ok(c.a>=0&&c.a<c.opts.length&&c.labs.length,"case "+(i+1)));

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
// deficit continuity
near(HK.calc({...base,pk:3}).deficit,350,"deficit 3"); near(HK.calc({...base,pk:2}).deficit,750,"deficit 2"); ok(HK.calc({...base,pk:4.2}).deficit===0,"deficit 0");
// gray zone K/Cr falls through to TTKG
r=HK.calc({...base,uk:12,ucr:7,uosm:600,posm:290,pk:2.8}); // K/Cr 1.71 gray, TTKG 2.07 low
ok(r.excretion.c==="low"&&r.excretion.by==="TTKG","gray K/Cr → TTKG");
// invalid TTKG ignored
r=HK.calc({...base,ucr:null,uosm:250}); ok(!r.ttkgValid&&r.excretion===null,"invalid TTKG ignored");
// 24h priority + conflict
r=HK.calc({...base,u24:9}); ok(r.excretion.c==="low"&&r.conflict,"24h priority + conflict");
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

console.log(fail?fail+" / "+n+" failed":"all "+n+" checks passed");
process.exit(fail?1:0);
