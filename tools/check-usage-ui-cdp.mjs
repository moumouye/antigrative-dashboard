// Zero-dependency UI gate: drives the system Chrome over CDP instead of
// downloading a Playwright browser. Fixtures are synthetic; no user data is
// read or written.
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const repo=join(dirname(fileURLToPath(import.meta.url)),'..');
const files=['compat/i18n.cjs','compat/theme.cjs','compat/inline-widget.cjs','compat/usage-ui.local.cjs'];
const sources=await Promise.all(files.map(f=>readFile(join(repo,f),'utf8')));
const extract=s=>s.slice(s.indexOf('module.exports = ')+17).trim().replace(/;$/,'');
const chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const models=['Gemini 3.8 Flash','Gemini 3.8 Pro','Claude Sonnet','Claude Opus','GPT 5.4'];
const days=Array.from({length:120},(_,i)=>{
  const d=new Date('2026-06-14T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);
  return {date:d.toISOString().slice(0,10),models:Object.fromEntries(models.map((m,j)=>{const n=(i*17+j*3)%11*1200;return [m,{uncached:n,cacheRead:n*2,cacheWrite:0,output:n,total:n*4,requests:n?1:0}];}))};
});
const hours=Object.fromEntries(Array.from({length:10},(_,i)=>[9+i,{uncached:(i+1)*1000,cacheRead:(i+1)*400,cacheWrite:0,output:(i+1)*200,total:(i+1)*1600,requests:i+1,models:{[models[0]]:{total:(i+1)*1600}}}]));
days.at(-1).hours=hours;
const fixture={accountKey:'fixture',today:'2026-10-11',timeZone:'Asia/Shanghai',models,days,todayTokens:45000,weekTokens:400000,monthTokens:700000,totalTokens:6000000,requests:500,firstDate:days[0].date,syncing:false,unknownRequests:1,partialRequests:1,unreadableFiles:0,hoursFrom:'2026-06-14'};
fixture.pricing={exchangeRate:7.1,exchangeRateUpdatedAt:'2026-10-10T00:00:00.000Z',lastSyncedAt:'2026-10-10T00:00:00.000Z',syncing:false,models:Object.fromEntries(models.map((m,j)=>[m,{prompt:1e-6*(j+1),completion:2e-6*(j+1),cacheRead:1e-7,cacheWrite:1e-7}]))};

const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#17181a;color:#ddd;font:13px 'Segoe UI';padding:50px}.rounded-composer{max-width:900px;margin:300px auto 0;background:#27282a;padding:12px;border-radius:18px}.editor{height:45px}.actions{display:flex;align-items:center;gap:5px}.left{display:flex;flex:1;min-width:0}.right{display:flex;gap:5px}button{background:transparent;border:0;color:inherit;height:28px}</style></head><body>
<div class="rounded-composer"><div class="editor" contenteditable="true" role="combobox" aria-label="Message input"></div><div class="actions"><div class="left"><button aria-label="Add context">＋</button><button data-testid="model-selector-trigger">Gemini 3.8 Flash</button></div><div class="right"><button aria-label="Record voice memo">♩</button><button aria-label="Send message">➜</button></div></div></div>
<script>
history.replaceState({},'', '/c/11111111-1111-1111-1111-111111111111');
window.testData=${JSON.stringify(fixture)};
window.testPrefs={language:'zh-CN',languageGuideDismissed:true,revision:1};
window.metricsRequests=[];
window.agPulseHost={getMetrics:async input=>{metricsRequests.push(input);return {connection:'live',usage:testData,preferences:testPrefs,groups:[],speed:null};},getPreferences:async()=>testPrefs,setPreferences:async x=>{if(window.failGuideSave&&x.usageGuideDismissed)throw Error('Fixture save failure');return testPrefs={...testPrefs,...x,revision:testPrefs.revision+1};}};
window.__agPulseI18nFactory=(${extract(sources[0])});
window.__agPulseThemeFactory=(${extract(sources[1])});
window.__agPulseUsageFactory=(${extract(sources[3])});
(${extract(sources[2])})();
</script></body></html>`;

const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(join(tmpdir(),'ag-cdp-'));
await mkdir(join(repo,'.data/usage'),{recursive:true});
const child=spawn(chrome,['--headless=new','--window-size=1100,900','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--disable-extensions','--disable-background-networking','--mute-audio',
  `--user-data-dir=${profile}`,'--remote-debugging-port=0',url],{stdio:'ignore'});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function devtools(){
  for(let i=0;i<100;i++){
    try{
      const [port]= (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n');
      const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=list.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1'));
      if(page)return page.webSocketDebuggerUrl;
    }catch{}
    await sleep(100);
  }
  throw Error('Chrome DevTools endpoint did not appear');
}

let ws;
const pending=new Map();
const errors=[];
function send(method,params={}){
  const id=++requests;
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
}
let requests=0;
async function evaluate(expression){
  const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(reply.error)throw Error(reply.error.message);
  const result=reply.result;
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression,label,timeout=8000){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(await evaluate(expression))return;await sleep(100);}
  throw Error(`Timed out waiting for ${label}`);
}

try{
  const wsUrl=await devtools();
  ws=new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||'exception');
    if(message.id&&pending.has(message.id)){pending.get(message.id).resolve(message);pending.delete(message.id);}
  };
  await send('Runtime.enable');
  await until(`document.readyState==='complete'&&!!document.getElementById('ag-pulse-status-bar')`,'status bar');

  await evaluate(`(()=>{const sr=document.getElementById('ag-pulse-status-bar').shadowRoot;sr.querySelector('[data-card=cache]').click();sr.querySelector('#open-usage').click();return true;})()`);
  await until(`(()=>{const d=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard');return !!d&&d.open;})()`,'usage dialog');

  const v=(expr)=>evaluate(`(()=>{const sr=document.getElementById('ag-pulse-status-bar').shadowRoot;const v=sr.getElementById('usage-dashboard').firstElementChild.shadowRoot;return ${expr};})()`);

  assert.equal(await v(`!!v.getElementById('usage-intro')`),true,'intro present');
  await v(`v.getElementById('usage-intro-done').click()`);
  await until(`(()=>{const sr=document.getElementById('ag-pulse-status-bar').shadowRoot;const v=sr.getElementById('usage-dashboard').firstElementChild.shadowRoot;return v.getElementById('usage-intro').hidden;})()`,'intro dismissed');

  assert.ok(await v(`v.querySelectorAll('#hourly-plot .bar-column').length`)>=1,'hourly bars render');
  assert.ok((await v(`v.getElementById('hourly-summary').textContent`)).includes('峰值'),'peak summary');
  assert.ok((await v(`v.getElementById('totals').textContent`)).includes('¥'),'cost rendered in CNY');
  assert.equal(await v(`!!v.getElementById('locale')||!!v.querySelector('.eyebrow')`),false,'no duplicate language toggle or English eyebrow');
  assert.equal(await evaluate(`metricsRequests.some(r=>r.usageSync===true)`),false,'opening a populated ledger never restarts a full import');
  assert.equal(await v(`v.getElementById('alert').hidden`),true,'partial records are not a warning');
  assert.equal(await v(`v.getElementById('note').hidden`),true,'the overview stays free of historical footnotes');

  const peakBefore=await v(`v.getElementById('hourly-summary').textContent`);
  await evaluate(`testData.days[testData.days.length-1].hours[9].total=999999999`);
  await sleep(4000);
  assert.notEqual(await v(`v.getElementById('hourly-summary').textContent`),peakBefore,'an open window refreshes on its own');
  const fitOverview=await v(`(()=>{const p=v.querySelector('.page');return {scroll:p.scrollHeight,client:p.clientHeight};})()`);
  assert.ok(fitOverview.scroll<=fitOverview.client+2,`overview must fit without scrolling (${fitOverview.scroll}>${fitOverview.client})`);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile('/tmp/ag-usage-new.png',Buffer.from(shot.result.data,'base64'));

  await v(`v.getElementById('details-tab').click()`);
  await until(`(()=>{const sr=document.getElementById('ag-pulse-status-bar').shadowRoot;const v=sr.getElementById('usage-dashboard').firstElementChild.shadowRoot;return !v.getElementById('details').hidden;})()`,'details tab');
  assert.ok(await v(`v.querySelectorAll('.bar-column').length`)>=28,'detail chart bars');
  assert.ok(await v(`v.querySelectorAll('#table-body tr').length`)>=1,'table rows');
  assert.equal(await v(`v.querySelectorAll('#comp-filters button').length`),3,'component filters');
  assert.ok((await v(`v.getElementById('note').textContent`)).includes('时间未知'),'only genuinely missing timestamps are footnoted');
  const fitDetails=await v(`(()=>{const p=v.querySelector('.page');return {scroll:p.scrollHeight,client:p.clientHeight};})()`);
  assert.ok(fitDetails.scroll<=fitDetails.client+2,`details must fit without scrolling (${fitDetails.scroll}>${fitDetails.client})`);

  const before=await v(`v.getElementById('totals').textContent`);
  await v(`v.querySelector('#comp-filters button').click()`);
  await sleep(200);
  const after=await v(`v.getElementById('totals').textContent`);
  assert.notEqual(before,after,'component filter changes totals');

  const costCell=await v(`(v.querySelector('#table-body tr td:last-child')?.textContent)||''`);
  assert.ok(costCell.includes('¥'),'table cost column');

  console.log(JSON.stringify({gate:'usage-ui',browser:chrome.replace('/Contents/MacOS/', ' '),checks:['entry','intro','single language control','no import on open','hourly chart','peak summary','live refresh','CNY cost','undated footnote','details tab','table','component filter'],passed:true,pageErrors:errors}));
  assert.deepEqual(errors,[]);
}finally{
  try{ws?.close();}catch{}
  child.kill('SIGKILL');
  await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
