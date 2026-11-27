// Bounded parallel runner for the Playwright browser verification checks.
// Reads canonical command lists from package.json so there is one source of truth.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {cpus,availableParallelism} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const splitChain=text=>String(text||'').split('&&').map(s=>s.trim()).filter(Boolean);

const suites={
  ui:splitChain(pkg.scripts['test:ui']),
  ide:['node tools/check-ide-ui.mjs'],
  usage:splitChain(pkg.scripts['test:usage-ui']),
  panel:splitChain(pkg.scripts['test:panel-ui']),
};
suites.all=[...suites.ui,...suites.ide,...suites.usage,...suites.panel];

// Schedule slower scripts first so tail stragglers do not limit wall-clock time.
const weight={
  'tools/check-task-usage-ui.mjs':100,
  'tools/check-token-usage-ui.mjs':90,
  'tools/check-theme-ui.mjs':80,
  'tools/check-collection-state-ui.mjs':70,
  'tools/check-usage-ui.mjs':65,
  'tools/check-ide-ui.mjs':60,
  'tools/check-localized-ui.mjs':40,
  'tools/check-inline-layout.mjs':35,
  'tools/check-panel-ui.mjs':30,
  'tools/check-density-motion.mjs':25,
  'tools/check-subagent-ui.mjs':20,
  'tools/check-update-ui.mjs':20,
};
const priority=cmd=>{
  const match=Object.entries(weight).find(([name])=>cmd.includes(name));
  return match?match[1]:10;
};

const args=process.argv.slice(2);
const suite=args.find(a=>!a.startsWith('-'))||'all';
const commands=suites[suite];
if(!commands){
  console.error(`Unknown suite "${suite}". Expected one of: ${Object.keys(suites).join(', ')}`);
  process.exit(2);
}

const jobArg=args.find(a=>a.startsWith('--jobs='));
const detected=typeof availableParallelism==='function'?availableParallelism():cpus().length;
const requested=Number(jobArg?jobArg.slice(7):process.env.PULSE_UI_JOBS||Math.min(4,Math.max(2,detected)));
const jobs=Math.max(1,Math.min(commands.length,Number.isFinite(requested)?requested:4));

const queue=[...commands].sort((a,b)=>priority(b)-priority(a));
const total=queue.length;
const startedAt=Date.now();
const results=[];
let failed=false;

function runOne(command){
  return new Promise(resolve=>{
    const parts=command.split(/\s+/);
    const start=Date.now();
    const child=spawn(parts[0],parts.slice(1),{cwd:root,stdio:['ignore','pipe','pipe'],env:process.env});
    const chunks=[];
    child.stdout.on('data',d=>chunks.push(d));
    child.stderr.on('data',d=>chunks.push(d));
    child.on('error',err=>{
      const sec=((Date.now()-start)/1000).toFixed(1);
      resolve({command,ok:false,sec,output:String(err)});
    });
    child.on('close',(code,signal)=>{
      const sec=((Date.now()-start)/1000).toFixed(1);
      resolve({command,ok:code===0&&!signal,code,signal,sec,output:Buffer.concat(chunks).toString('utf8')});
    });
  });
}

async function worker(){
  while(queue.length){
    const command=queue.shift();
    const res=await runOne(command);
    results.push(res);
    const status=res.ok?'PASS':'FAIL';
    console.log(`[${results.length}/${total}] ${status} (${res.sec}s) ${res.command}`);
    if(!res.ok){
      failed=true;
      const lines=res.output.trim().split('\n').slice(-40).join('\n');
      if(lines)console.error(`--- ${res.command} ---\n${lines}\n--- end ---`);
    }
  }
}

await Promise.all(Array.from({length:jobs},()=>worker()));
const totalSec=((Date.now()-startedAt)/1000).toFixed(1);
console.log(`UI gates (${suite}): ${results.filter(r=>r.ok).length}/${total} passed in ${totalSec}s (jobs=${jobs})`);
process.exit(failed?1:0);
