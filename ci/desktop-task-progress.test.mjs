import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { desktopProgress,taskEvent } from './desktop-task-progress.mjs';
import { CONTRACT,POLICY,TASKS,desktopResult } from './desktop-catalog.mjs';
const binding={headRef:'a'.repeat(40),baseRef:'b'.repeat(40),testedRef:'c'.repeat(40),workflowRef:'d'.repeat(40),prNumber:274,runId:123,runAttempt:1,platform:'darwin-arm64'};
const uuid='11111111-1111-4111-8111-111111111111';
function fixture(t,begin=2000){
  const root=realpathSync(mkdtempSync(join(tmpdir(),'hear-live-progress-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const directory=join(root,'core/.artifacts/hear-verify',uuid);mkdirSync(directory,{recursive:true});
  const report={kind:'hear-desktop-verification',scope:'hear-desktop',profile:'full',environmentPolicy:'hear-desktop-defaults-v1',runId:uuid,host:{platform:'darwin',arch:'arm64',node:'v24.22.0'},source:{head:binding.testedRef,dirty:false},catalogExecution:{policy:POLICY,scope:'hear-desktop',profile:'full',contractSha256:CONTRACT,selectionApplied:false},tasks:TASKS.map(id=>({id,status:'NOT_RUN',reason:'PRIVATE'})),startedAt:new Date(begin).toISOString()};
  writeFileSync(join(directory,'summary.json'),JSON.stringify(report));writeFileSync(join(root,'desktop-catalog-start.json'),JSON.stringify({binding,startedAt:1000}));
  const env={HEAD_REF:binding.headRef,BASE_REF:binding.baseRef,TESTED_REF:binding.testedRef,PR_NUMBER:String(binding.prNumber),GITHUB_SHA:binding.workflowRef,GITHUB_RUN_ID:String(binding.runId),GITHUB_RUN_ATTEMPT:'1',RUNNER_TEMP:root};
  return {root,env,report,directory,file:join(directory,'progress.jsonl')};
}
const event=(id,status,durationMs=0)=>JSON.stringify({id,status,durationMs,reason:'PRIVATE-PATH',tests:['PRIVATE-CASE'],output:'PRIVATE-CONTENT'})+'\n';
test('only fixed desktop IDs/statuses/durations reach public output',()=>{
  assert.deepEqual(taskEvent({id:'hear-native',status:'PASS',durationMs:12,source:'PRIVATE'}),{id:'hear-native',status:'PASS',durationMs:12});
  for(const change of [{id:'reader-unit'},{id:'PRIVATE'},{status:'REUSED'},{durationMs:NaN},{durationMs:-1},{durationMs:4500001}])assert.equal(taskEvent({id:'hear-unit',status:'PASS',durationMs:1,...change}),null);
});
test('ordered, deduplicated, source-bound observations never satisfy the final gate',t=>{
  const f=fixture(t),lines=[],p=desktopProgress({...f,now:()=>2000,emit:line=>lines.push(line)});
  writeFileSync(f.file,event('hear-tools','PASS',2)+event('hear-tools','RUNNING'));p.flush();p.flush();assert.equal(lines.length,1);
  const terminal=event('hear-tools','PASS',100);appendFileSync(f.file,terminal.trimEnd());p.flush();assert.equal(lines.length,1);appendFileSync(f.file,'\n');p.flush();p.flush();
  appendFileSync(f.file,event('hear-tools','FAIL',101)+event('hear-unit','NOT_RUN'));const r=p.finish();assert.equal(lines.length,3);assert.doesNotMatch(lines.join(''),/PRIVATE/);
  assert.equal(r.authoritative,false);assert.deepEqual(r.binding,binding);assert.equal(r.preparationDurationMs,1000);assert.equal(r.graphWrapperDurationMs,0);assert.equal(r.tasks[0].status,'PASS');assert.equal(r.tasks[1].status,'NOT_RUN');
  assert.equal(desktopResult(Buffer.from(JSON.stringify(r)),binding,'success',1000,null,2000).status,'FAIL');
  assert.throws(()=>desktopProgress({...f,env:{...f.env,TESTED_REF:'e'.repeat(40)},now:()=>2000}));
});
test('stale/wrong-scope summaries, oversized data, partial writes and linked paths publish nothing',t=>{
 for(const mutation of [r=>r.source.head='e'.repeat(40),r=>r.source.dirty=true,r=>r.scope='hear-source',r=>r.startedAt=new Date(1).toISOString(),r=>r.runId='22222222-2222-4222-8222-222222222222',r=>r.catalogExecution.contractSha256='0'.repeat(64),r=>r.tasks.pop()]){
  const f=fixture(t),lines=[];mutation(f.report);writeFileSync(join(f.directory,'summary.json'),JSON.stringify(f.report));writeFileSync(f.file,event('hear-tools','RUNNING'));desktopProgress({...f,now:()=>2000,emit:line=>lines.push(line)}).flush();assert.equal(lines.length,0);
 }
 const f=fixture(t),lines=[],p=desktopProgress({...f,now:()=>2000,emit:line=>lines.push(line)});writeFileSync(f.file,'x'.repeat(65537));p.flush();rmSync(f.file);writeFileSync(join(f.root,'outside'),event('hear-tools','RUNNING'));symlinkSync(join(f.root,'outside'),f.file);p.flush();assert.equal(lines.length,0);
 rmSync(f.file);writeFileSync(f.file,event('hear-tools','RUNNING'));mkdirSync(join(f.root,'core/.artifacts/hear-verify','22222222-2222-4222-8222-222222222222'));p.flush();assert.equal(lines.length,0);
});
test('rewritten or truncated streams cannot reinterpret earlier rejected events',t=>{
 const f=fixture(t),lines=[],p=desktopProgress({...f,now:()=>2000,emit:line=>lines.push(line)});writeFileSync(f.file,event('hear-tools','RUNNING'));p.flush();assert.equal(lines.length,1);
 writeFileSync(f.file,event('hear-tools','PASS',1));p.flush();appendFileSync(f.file,event('hear-tools','RUNNING')+event('hear-tools','PASS',2));p.flush();assert.equal(lines.length,1);assert.equal(p.finish().tasks[0].status,'RUNNING');
});
test('safe job summary contains only fixed IDs and observations',t=>{
 const f=fixture(t),file=join(f.root,'summary.md');writeFileSync(file,'');writeFileSync(f.file,event('hear-tools','RUNNING')+event('hear-tools','FAIL',10));
 desktopProgress({...f,env:{...f.env,GITHUB_STEP_SUMMARY:file},now:()=>2000,emit:()=>{}}).finish();const text=readFileSync(file,'utf8');assert.match(text,/final receipt determines success/);assert.match(text,/hear-tools \| FAIL \| 10/);assert.doesNotMatch(text,/PRIVATE|hear-live-progress/);
});
test('actual private step emits live progress, hides child output and preserves failure',{timeout:15000},async t=>{
 const f=fixture(t,Date.now());const started=JSON.parse(readFileSync(join(f.root,'desktop-catalog-start.json')));started.startedAt=Date.now()-100;writeFileSync(join(f.root,'desktop-catalog-start.json'),JSON.stringify(started));
 const script=`const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(f.file)},${JSON.stringify(event('hear-tools','RUNNING'))});console.log('PRIVATE-STDOUT');console.error('PRIVATE-STDERR');setTimeout(()=>{fs.appendFileSync(${JSON.stringify(f.file)},${JSON.stringify(event('hear-tools','PASS',1500))});process.exit(7)},1800);`;
 const child=spawn(process.execPath,[join(import.meta.dirname,'private-step.mjs'),'desktop-catalog','core',process.execPath,'-e',script],{cwd:f.root,env:{...process.env,...f.env},stdio:['ignore','pipe','pipe']});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
 let text='',live=false;child.stdout.on('data',b=>{text+=b;if(text.includes('RUNNING')&&child.exitCode===null)live=true;});child.stderr.on('data',b=>{text+=b;});
 const status=await new Promise(resolve=>child.once('close',resolve));assert.equal(status,1);assert(live);assert.doesNotMatch(text,/PRIVATE-/);assert.match(readFileSync(join(f.root,'hear-private.log'),'utf8'),/PRIVATE-STDOUT/);
 const progress=JSON.parse(readFileSync(join(f.root,'desktop-catalog-progress/progress.json')));assert.equal(progress.authoritative,false);assert.equal(progress.tasks[0].status,'PASS');
});
