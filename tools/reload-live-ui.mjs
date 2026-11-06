// Reload the injected widget in the running Antigravity renderer.
// No app restart: disposes the current controller and re-installs it from the
// repository sources over the existing DevTools binding.
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';

const repo=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=process.argv.includes('--installed')?'installed':'repo';
const base=source==='installed'?join(homedir(),'.gemini/config/plugins/antigravity-pulse/compat'):join(repo,'compat');
const read=name=>readFile(join(base,name),'utf8');
const extract=s=>s.slice(s.indexOf('module.exports = ')+17).trim().replace(/;$/,'');

const portFile=join(homedir(),'Library/Application Support/Antigravity/DevToolsActivePort');
const arg=process.argv.find(a=>/^\d+$/.test(a));
const port=arg||readFileSync(portFile,'utf8').split('\n')[0].trim();
const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page=targets.find(t=>t.type==='page');
if(!page)throw Error('No Antigravity page target on port '+port);

const [i18n,theme,update,usage,inline]=await Promise.all(['i18n.cjs','theme.cjs','update-ui.cjs','usage-ui.cjs','inline-widget.cjs'].map(read));
const payload=`(()=>{
  try{window.__agPulseDispose&&window.__agPulseDispose();}catch(e){}
  window.__agPulseI18nFactory=(${extract(i18n)});
  window.__agPulseThemeFactory=(${extract(theme)});
  window.__agPulseUpdateFactory=(${extract(update)});
  window.__agPulseUsageFactory=(${extract(usage)});
  (${extract(inline)})();
  return 'reloaded';
})()`;

const ws=new WebSocket(page.webSocketDebuggerUrl);
let id=0;const pending=new Map();
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}};
const send=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{
  const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(reply.result?.exceptionDetails)throw Error(reply.result.exceptionDetails.exception?.description||reply.result.exceptionDetails.text);
  return reply.result?.result?.value;
};
const result=await evaluate(payload);
await new Promise(resolve=>setTimeout(resolve,1200));
const mounted=await evaluate(`!!document.getElementById('ag-pulse-status-bar')?.shadowRoot?.querySelector('#open-usage')`);
ws.close();
if(!mounted)throw Error('The widget did not remount; reopen Antigravity to recover');
console.log(JSON.stringify({source,port,result,mounted}));
