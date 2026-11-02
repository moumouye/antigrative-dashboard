import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir} from 'node:fs/promises';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {UsageLedger,UNIFIED_SCOPE,HOUR_DAYS,dateKey,hourKey} from '../usage.mjs';
const account='a'.repeat(64),id='11111111-1111-1111-1111-111111111111',now=Date.parse('2026-10-12T00:00:00Z');
const hash=value=>createHash('sha256').update(value).digest('hex');
// SQLite is unavailable under some sandboxed test runners; the disk path is
// still covered wherever node:sqlite can create a journal.
const sqlite=(()=>{try{const dir=mkdtempSync(join(tmpdir(),'ag-sqlite-'));const db=new DatabaseSync(join(dir,'probe.sqlite'));db.exec('CREATE TABLE t(x)');db.close();return true;}catch{return false;}})();
const row=(n,at,model)=>({id:hash('row'+n),at,model,uncached:100+n,cacheRead:10,cacheWrite:5,output:20,partial:false,timeBasis:'request-start'});
async function fixture(){return mkdtemp(join(tmpdir(),'ag-hours-'));}
const jobDb=async(dir,rows)=>{
  const file=join(dir,'job.sqlite'),db=new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=OFF;CREATE TABLE usage(id TEXT PRIMARY KEY,j TEXT NOT NULL)');
  for(const r of rows)db.prepare('INSERT INTO usage VALUES(?,?)').run(r.id,JSON.stringify(r));
  db.close();return file;
};
test('hourly buckets are identical through the in-memory and disk summary paths',{skip:sqlite?false:'node:sqlite is unavailable in this environment'},async ()=>{
  const rows=Array.from({length:6},(_,i)=>row(i,Date.parse('2026-10-11T0'+(5+i)+':30:00Z'),i%2?'Gemini 3.8 Flash':'Claude 4.6'));
  const jsonDir=await fixture();
  await mkdir(join(jsonDir,UNIFIED_SCOPE),{recursive:true});
  const name=hash(id)+'.json';
  await writeFile(join(jsonDir,UNIFIED_SCOPE,name),JSON.stringify({schema:1,account:UNIFIED_SCOPE,records:rows}));
  const memory=await new UsageLedger(jsonDir).summary(account,now);
  const diskDir=await fixture();
  await mkdir(join(diskDir,UNIFIED_SCOPE),{recursive:true});
  await writeFile(join(diskDir,UNIFIED_SCOPE,name),JSON.stringify({schema:1,account:UNIFIED_SCOPE,records:rows}));
  const ledger=new UsageLedger(diskDir);
  const job=await jobDb(diskDir,rows);
  await ledger.ingestDisk(account,id,job);
  await ledger.summary(account,now);
  await ledger.diskSummaryPending;
  const disk=await ledger.summary(account,now);
  assert.deepEqual(disk.days.at(-1).hours,memory.days.at(-1).hours);
  assert.equal(disk.hoursFrom,memory.hoursFrom);
  assert.equal(memory.days.at(-1).hours[hourKey(rows[0].at)].total,135);
  assert.deepEqual(memory.days.at(-1).hours[hourKey(rows[0].at)].models,{'Claude 4.6':{total:135}});
});
test('hours outside the retained window still contribute to daily totals',async ()=>{
  const ledger=new UsageLedger(await fixture());
  const old=now-(HOUR_DAYS+5)*86400000;
  await ledger.ingestRows(account,id,[row(1,old,'Gemini 3.8 Flash'),row(2,Date.parse('2026-10-11T05:30:00Z'),'Gemini 3.8 Flash')]);
  const summary=await ledger.summary(account,now);
  const oldDay=summary.days.find(day=>day.date===dateKey(old));
  const today=summary.days.find(day=>day.date==='2026-10-11');
  assert.equal(oldDay.hours,undefined);
  assert.ok(today.hours[hourKey(Date.parse('2026-10-11T05:30:00Z'))]);
  assert.equal(summary.totalTokens,273);
  assert.equal(summary.hoursFrom,dateKey(now-HOUR_DAYS*86400000));
});
test('a long ledger keeps hourly detail bounded and never reports a stale summary',async ()=>{
  const ledger=new UsageLedger(await fixture());
  const rows=[],models=['Gemini 3.8 Flash','Claude 4.6','GPT 5.1'];
  for(let day=0;day<180;day++)for(let hour=0;hour<6;hour++)rows.push(row(day*10+hour,now-day*86400000-hour*3600000,models[(day+hour)%models.length]));
  await ledger.ingestRows(account,id,rows);
  const summary=await ledger.summary(account,now);
  assert.equal(summary.summaryStale,undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(summary))<4.5*1024*1024);
  assert.ok(summary.days.filter(day=>day.hours).length<=HOUR_DAYS+1);
  const files=(await readdir(join(ledger.directory,UNIFIED_SCOPE))).filter(name=>name.endsWith('.json'));
  assert.equal(files.length,1);
});
