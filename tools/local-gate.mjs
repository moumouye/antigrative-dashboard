// Single entry point for every local verification step.
//
// Upstream owns the gate scripts themselves; this file only decides which of
// them run, in which order, and with which dependencies present. Adding a gate
// here keeps package.json untouched: that file sits in the upstream hot zone
// (churn 20/60) and must not grow local script entries.
//
//   node tools/local-gate.mjs          zero-dependency gates (default)
//   node tools/local-gate.mjs --full   adds gates that import playwright
//   node tools/local-gate.mjs --list   print the plan without running it
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(join(root,'package.json'));
const python=process.env.PYTHON||(spawnSync('python3',['--version'],{stdio:'ignore'}).status===0?'python3':'python');

// Zero-dependency gates. Must run on a clean clone with no node_modules.
const BASE=[
  {id:'unit',label:'Node unit tests',cmd:'npm',args:['test'],timeout:600000},
  {id:'lifecycle',label:'Python lifecycle tests',cmd:python,args:['-m','unittest','discover','-s','tests'],timeout:600000},
  {id:'usage-ui',label:'Usage dashboard over system Chrome',cmd:'node',args:['tools/check-usage-ui-cdp.mjs'],timeout:300000},
];

// Gates that import playwright. Upstream CI installs it with
// `npm install --no-save --package-lock=false playwright`; locally the same
// command unlocks them without touching package.json.
const BROWSER=[
  {id:'ui',label:'Upstream UI gates',cmd:'npm',args:['run','test:ui']},
  {id:'panel-ui',label:'Panel UI gates',cmd:'npm',args:['run','test:panel-ui']},
  {id:'usage-ui-upstream',label:'Upstream usage gates',cmd:'npm',args:['run','test:usage-ui']},
  {id:'ide',label:'IDE gates',cmd:'npm',args:['run','test:ide']},
  {id:'update',label:'Update process gates',cmd:'npm',args:['run','test:update-process']},
];

const argv=new Set(process.argv.slice(2));
const full=argv.has('--full');
const hasPlaywright=(()=>{
  try{require.resolve('playwright');return true;}catch{return false;}
})();
const steps=full?[...BASE,...BROWSER]:BASE;

if(argv.has('--list')){
  for(const step of steps)console.log(`${step.id}\t${step.cmd} ${step.args.join(' ')}`);
  console.log(`\nplaywright: ${hasPlaywright?'available':'missing'}`);
  process.exit(0);
}
if(full&&!hasPlaywright){
  console.error('--full needs playwright. Install it without editing package.json:\n\n  npm install --no-save --package-lock=false playwright\n  npx playwright install chromium\n');
  process.exit(2);
}

let failed=null;
const results=[];
for(const [index,step] of steps.entries()){
  const startedAt=Date.now();
  process.stdout.write(`[${index+1}/${steps.length}] ${step.label} ... `);
  const run=spawnSync(step.cmd,step.args,{cwd:root,stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:step.timeout??300000});
  const seconds=((Date.now()-startedAt)/1000).toFixed(1);
  const ok=run.status===0;
  results.push({id:step.id,ok,seconds});
  console.log(ok?`PASS ${seconds}s`:`FAIL ${seconds}s`);
  if(!ok){
    const output=`${run.stdout??''}${run.stderr??''}`.trim();
    console.log(`\n--- ${step.id} output (tail) ---\n${output.split('\n').slice(-25).join('\n')}\n`);
    failed=step;
    break;
  }
}

const skipped=steps.slice(results.length);
if(skipped.length)console.log(`\nskipped after failure: ${skipped.map(s=>s.id).join(', ')}`);
console.log(`\n${results.filter(r=>r.ok).length}/${steps.length} gates passed`+(failed?` — failed at ${failed.id}`:''));
if(!full&&hasPlaywright)console.log('playwright is available: run with --full for the browser gate matrix.');
process.exit(failed?1:0);
