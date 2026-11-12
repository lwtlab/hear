// Informational only: never consumed by desktopResult or --require-pass.
import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkedBinding,CONTRACT,POLICY,TASKS } from './desktop-catalog.mjs';
const allowed=new Set(TASKS),uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function taskEvent(value){
  if(!value||!allowed.has(value.id)||!['RUNNING','PASS','FAIL','NOT_RUN'].includes(value.status)||!Number.isSafeInteger(value.durationMs)||value.durationMs<0||value.durationMs>75*60*1000)return null;
  if(['RUNNING','NOT_RUN'].includes(value.status)&&value.durationMs!==0)return null;
  return {id:value.id,status:value.status,durationMs:value.durationMs};
}
function directory(file){const info=lstatSync(file);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal(realpathSync(file),file);}
function ordinary(file,maximum){
  const info=lstatSync(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=maximum);assert.equal(realpathSync(file),file);
  const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const opened=fstatSync(fd);assert(opened.isFile()&&opened.size<=maximum&&opened.ino===info.ino&&opened.dev===info.dev);
    const bytes=Buffer.alloc(Math.min(opened.size+1,maximum+1));let used=0;
    while(used<bytes.length){const n=readSync(fd,bytes,used,bytes.length-used,null);if(!n)break;used+=n;}
    assert(used<=maximum&&used<=opened.size);return bytes.subarray(0,used);
  }finally{closeSync(fd);}
}
export function desktopProgress({root=process.cwd(),env=process.env,emit=line=>console.log(line),now=Date.now}={}){
  root=realpathSync(root);
  const started=JSON.parse(ordinary(join(root,'desktop-catalog-start.json'),65536));
  const binding=checkedBinding({headRef:env.HEAD_REF,baseRef:env.BASE_REF,testedRef:env.TESTED_REF,workflowRef:env.GITHUB_SHA,prNumber:Number(env.PR_NUMBER),runId:Number(env.GITHUB_RUN_ID),runAttempt:Number(env.GITHUB_RUN_ATTEMPT),platform:started.binding?.platform});
  assert.deepEqual(started.binding,binding);
  const begin=now();assert(Number.isSafeInteger(started.startedAt)&&started.startedAt>0&&started.startedAt<=begin&&begin-started.startedAt<=75*60*1000);
  const observed=new Map();let timer,directoryId,consumed=Buffer.alloc(0),invalidStream=false;
  function flush(){
    try{
      if(invalidStream)return;
      const core=join(root,'core'),artifacts=join(core,'.artifacts'),base=join(artifacts,'hear-verify');
      for(const file of [core,artifacts,base])directory(file);
      const ids=readdirSync(base).filter(id=>uuid.test(id));if(ids.length!==1||directoryId&&directoryId!==ids[0])return;
      const folder=join(base,ids[0]);directory(folder);
      const report=JSON.parse(ordinary(join(folder,'summary.json'),2*1024*1024));
      assert.equal(report.kind,'hear-desktop-verification');assert.equal(report.scope,'hear-desktop');assert.equal(report.profile,'full');assert.equal(report.environmentPolicy,'hear-desktop-defaults-v1');
      assert.deepEqual(report.host,{platform:'darwin',arch:'arm64',node:'v24.22.0'});
      assert.equal(report.runId,ids[0]);assert.equal(report.source.head,binding.testedRef);assert.equal(report.source.dirty,false);
      assert.equal(report.catalogExecution.policy,POLICY);assert.equal(report.catalogExecution.scope,'hear-desktop');assert.equal(report.catalogExecution.profile,'full');assert.equal(report.catalogExecution.contractSha256,CONTRACT);assert.equal(report.catalogExecution.selectionApplied,false);
      assert.deepEqual(report.tasks.map(task=>task.id),TASKS);
      const at=Date.parse(report.startedAt);assert(Number.isFinite(at)&&at>=begin-1000&&at<=now()+1000);
      const bytes=ordinary(join(folder,'progress.jsonl'),65536);directoryId=ids[0];
      if(bytes.length<consumed.length||!bytes.subarray(0,consumed.length).equals(consumed)){invalidStream=true;return;}
      const end=bytes.lastIndexOf(10)+1;if(end<=consumed.length)return;
      const lines=bytes.subarray(consumed.length,end).toString().split('\n');lines.pop();consumed=Buffer.from(bytes.subarray(0,end));
      for(const line of lines){
        if(line.length>512)continue;let value;try{value=JSON.parse(line);}catch{continue;}
        const event=taskEvent(value);if(!event)continue;const previous=observed.get(event.id);
        if(previous&&previous.status!=='RUNNING'||previous?.status===event.status)continue;
        if(['PASS','FAIL'].includes(event.status)&&previous?.status!=='RUNNING')continue;
        if(event.status==='NOT_RUN'&&previous)continue;
        observed.set(event.id,event);emit(`Task progress (informational): ${JSON.stringify(event)}`);
      }
    }catch{/* Missing/invalid progress never supplies gate evidence or raw errors. */}
  }
  return {
    start(){timer=setInterval(flush,1000);timer.unref();},flush,
    finish(){
      clearInterval(timer);flush();
      const report={schemaVersion:1,kind:'hear-informational-desktop-progress',authoritative:false,binding,policy:POLICY,scope:'hear-desktop',profile:'full',selectionApplied:false,contractSha256:CONTRACT,preparationDurationMs:begin-started.startedAt,graphWrapperDurationMs:Math.max(0,now()-begin),tasks:TASKS.filter(id=>observed.has(id)).map(id=>observed.get(id))};
      // A fixed sibling output, separate from the authoritative receipt directory.
      const output=join(root,'desktop-catalog-progress');
      if(!existsSync(output))mkdirSync(output,{mode:0o700});directory(output);
      const file=join(output,'progress.json');if(existsSync(file))ordinary(file,65536);
      writeFileSync(file,JSON.stringify(report,null,2)+'\n',{mode:0o600});
      if(env.GITHUB_STEP_SUMMARY){
        ordinary(env.GITHUB_STEP_SUMMARY,8*1024*1024);
        const rows=report.tasks.map(t=>`| ${t.id} | ${t.status} | ${t.durationMs} |`).join('\n');
        appendFileSync(env.GITHUB_STEP_SUMMARY,`\n### Hear informational task progress\n\nOnly the independently validated final receipt determines success.\n\nPreparation before graph wrapper: ${report.preparationDurationMs} ms. Graph wrapper: ${report.graphWrapperDurationMs} ms.\n\n| Task | Observed status | Duration ms |\n| --- | --- | --- |\n${rows}\n`);
      }
      return report;
    }
  };
}
