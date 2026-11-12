import assert from 'node:assert/strict';
import { createHash,generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { CONTRACT,GRAPH,PINS,POLICY,TASKS,DEPENDENCIES,checkedBinding,desktopResult,verifyImplementation,validatePlan } from './desktop-catalog.mjs';
import { decryptLog } from './log-crypto.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const binding={headRef:'a'.repeat(40),baseRef:'b'.repeat(40),testedRef:'c'.repeat(40),workflowRef:'d'.repeat(40),prNumber:274,runId:123,runAttempt:1,platform:'darwin-arm64'};
const runId='11111111-1111-4111-8111-111111111111';
function fixture() {
  const source={head:binding.testedRef,dirty:false,inputHash:'e'.repeat(64),submodules:[],private:'PRIVATE_SOURCE_PATH'},inputs={sha256:'f'.repeat(64),taskGraphSha256:GRAPH};
  const native={schemaVersion:1,kind:'hear-native-build',coreRef:binding.testedRef,clean:true,platform:'darwin',arch:'arm64',napi:'10',filename:'hear-core.darwin-arm64.node',sha256:digest(Buffer.from('SYNTHETIC_NATIVE_CONTROL'))};
  const tasks=TASKS.map(id=>({id,status:'PASS',durationMs:1,exitCode:0,...(['hear-unit','hear-gui'].includes(id)?{tests:{passed:5,failed:0,skipped:[{title:'PRIVATE_CONDITIONAL_CASE'}]}}:{})}));
  const begin=Date.now()-1000;
  return {schemaVersion:1,kind:'hear-desktop-verification',runId,scope:'hear-desktop',profile:'full',status:'PASS',environmentPolicy:'hear-desktop-defaults-v1',host:{platform:'darwin',arch:'arm64',node:'v24.22.0'},source,sourceAfter:structuredClone(source),inputs,inputsAfter:{...inputs},startedAt:new Date(begin).toISOString(),endedAt:new Date(begin+100).toISOString(),durationMs:100,tasks,catalogExecution:{policy:POLICY,scope:'hear-desktop',profile:'full',selectionApplied:false,contractSha256:CONTRACT,status:'PASS',tasks:TASKS.map(id=>({id,status:'PASS'}))},nativeOrigin:native,acceptance:{nativeCompilation:'PASS',scriptedGui:'PASS',signedInstallation:'NOT_RUN',physicalAudio:'NOT_RUN',modelInference:'NOT_RUN'}};
}
const bytes=value=>Buffer.from(JSON.stringify(value));
const result=(report,execution='success')=>desktopResult(bytes(report),binding,execution,Date.now()-10000,report.nativeOrigin);
test('shared native/GUI receipt binds exact source and tests without exposing paths, case names or output',()=>{
 const r=result(fixture());assert.equal(r.status,'PASS');assert.equal(r.validation,'PASS');assert.equal(r.acceptance.scriptedGui,'PASS');assert.equal(r.acceptance.modelInference,'NOT_RUN');assert.deepEqual(r.tests.gui,{passed:5,failed:0,skipped:1});assert.equal(r.nativeOrigin.coreRef,binding.testedRef);assert.equal(r.tasks.length,7);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_/);
 for(const key of ['headRef','baseRef','testedRef','workflowRef'])assert.equal(r[key],binding[key]);
 assert.equal(Object.keys(PINS).length,13);assert.equal(digest(JSON.stringify(PINS)),r.executorGraphSha256);
});
test('missing/stale/reused coverage, report counts, native proof and cleanup failures never PASS',()=>{
 for(const change of [r=>r.source.head='a'.repeat(40),r=>r.source.dirty=true,r=>r.sourceAfter.inputHash='0'.repeat(64),r=>r.inputsAfter.sha256='0'.repeat(64),r=>r.inputs.taskGraphSha256='0'.repeat(64),r=>r.tasks.pop(),r=>r.tasks.push(r.tasks[0]),r=>r.tasks[0].status='REUSED',r=>r.tasks[0].exitCode=1,r=>r.tasks[2].tests.passed=0,r=>r.tasks[6].tests.failed=1,r=>r.tasks[6].tests.skipped=1,r=>r.nativeOrigin.coreRef=binding.headRef,r=>r.nativeOrigin.clean=false,r=>r.nativeOrigin.filename='foreign.node',r=>r.catalogExecution.contractSha256='0'.repeat(64),r=>r.catalogExecution.selectionApplied=true,r=>r.cleanupFailure='PRIVATE_ERROR',r=>r.nativeFailure='PRIVATE_ERROR',r=>r.acceptance.physicalAudio='PASS']) {const r=fixture();change(r);assert.equal(result(r).status,'FAIL');}
 for(const execution of ['failure','cancelled','skipped',undefined])assert.equal(desktopResult(bytes(fixture()),binding,execution,Date.now()-10000,fixture().nativeOrigin).status,'FAIL');
 assert.equal(desktopResult(bytes(fixture()),binding,'success',Date.now()-10000,null).status,'FAIL');
});
test('coverage validates real prerequisites rather than a false linear native/source chain',()=>{
 const report=fixture();report.status='FAIL';report.tasks[2].status='FAIL';report.tasks[2].exitCode=1;report.tasks[6].status='NOT_RUN';report.tasks[6].exitCode=null;report.catalogExecution.status='FAIL';report.catalogExecution.tasks=report.tasks.map(({id,status})=>({id,status}));
 const r=result(report,'failure');assert.equal(r.validation,'PASS');assert.equal(r.status,'FAIL');assert.equal(r.tasks[5].status,'PASS');
 report.tasks[6].status='PASS';report.tasks[6].exitCode=0;report.catalogExecution.tasks=report.tasks.map(({id,status})=>({id,status}));assert.equal(result(report).validation,'FAIL');
 assert.deepEqual(DEPENDENCIES[5],['hear-tools','core-asr-controls']);
});
test('unreviewed executable graph is rejected before a private plan/driver can run',t=>{
 const root=mkdtempSync(join(tmpdir(),'desktop-pins-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'scripts'));writeFileSync(join(root,'scripts/verify-hear.mjs'),"throw Error('unreviewed')");assert.throws(()=>verifyImplementation(root));
 assert.throws(()=>validatePlan({contractSha256:CONTRACT,scope:'hear-desktop',tasks:[]}));
 assert.throws(()=>checkedBinding({...binding,platform:'linux-x64'}));assert.throws(()=>checkedBinding({...binding,headRef:'main'}));
});
test('workflow keeps fresh native build, complete graph, encryption and source identity separate from release/audio',()=>{
 const yaml=readFileSync(new URL('../.github/workflows/cross-platform-probe.yml',import.meta.url),'utf8'),job=yaml.split('  desktop-catalog:')[1].split('  source-catalog:')[0];
 assert.match(job,/if: inputs.target == 'desktop-macos'/);assert.match(job,/runs-on: macos-26/);assert.match(job,/fetch-depth: 2/);assert.match(job,/persist-credentials: false/);assert(job.indexOf('--verify-input')<job.indexOf('private-step.mjs prepare'));assert(job.indexOf('hear.sh init')<job.indexOf('hear.sh desktop-check'));
 assert.match(job,/DESKTOP_EXECUTION_OUTCOME: \$\{\{ steps.desktop_checks.outcome \}\}/);assert.match(job,/--require-pass/);assert.match(job,/retention-days: 7/);assert.doesNotMatch(job,/continue-on-error|release create|actions\/cache|secrets.*TOKEN|site-deploy/);
 assert.match(yaml,/if: inputs.target != 'source-unix' && inputs.target != 'desktop-macos'/);
});
test('actual collector authenticates original summary/native bytes and rejects replacement',{skip:process.platform!=='darwin'||process.arch!=='arm64'},t=>{
 const root=mkdtempSync(join(tmpdir(),'desktop-collector-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const keys=generateKeyPairSync('rsa',{modulusLength:2048});
 const env={...process.env,HEAD_REF:binding.headRef,BASE_REF:binding.baseRef,TESTED_REF:binding.testedRef,PR_NUMBER:'274',GITHUB_SHA:binding.workflowRef,GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',DESKTOP_EXECUTION_OUTCOME:'success',HEAR_LOG_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'}),RUNNER_TEMP:root,DESKTOP_APP_REF:'',DESKTOP_CORE_REF:''};for(const key of ['DESKTOP_FUNCTIONAL_RUNTIME','DESKTOP_REUSE_NATIVE','DESKTOP_REUSE_RUNTIME','DESKTOP_WINDOWS_SIGNAL'])env[key]='false';
 const cli=join(import.meta.dirname,'desktop-catalog.mjs'),call=mode=>spawnSync(process.execPath,[cli,mode],{cwd:root,env,encoding:'utf8'});assert.equal(call('--start').status,0);
 const report=fixture();report.startedAt=new Date().toISOString();report.endedAt=report.startedAt;report.durationMs=0;
 const folder=join(root,'core/.artifacts/hear-verify',runId),native=join(root,'core/hear-core');mkdirSync(folder,{recursive:true});mkdirSync(native,{recursive:true});const summaryFile=join(folder,'summary.json');writeFileSync(summaryFile,bytes(report));writeFileSync(join(native,'native-origin.json'),JSON.stringify(report.nativeOrigin));writeFileSync(join(native,report.nativeOrigin.filename),'SYNTHETIC_NATIVE_CONTROL');writeFileSync(join(root,'hear-private.log'),'SYNTHETIC_PRIVATE_LOG');
 assert.equal(call('--collect').status,0);assert.equal(call('--require-pass').status,0);const r=JSON.parse(readFileSync(join(root,'desktop-catalog-receipt/verification.json')));assert.equal(r.status,'PASS');
 for(const [name,expected]of [['summary',bytes(report)],['native',Buffer.from('SYNTHETIC_NATIVE_CONTROL')],['log',Buffer.from('SYNTHETIC_PRIVATE_LOG')]]) {const envelope=readFileSync(join(root,`diagnostics/desktop-${name}.enc.json`));assert.equal(digest(envelope),r.diagnostics[name]);assert.deepEqual(decryptLog(JSON.parse(envelope),keys.privateKey.export({type:'pkcs8',format:'pem'})),expected);}
 report.runId='22222222-2222-4222-8222-222222222222';writeFileSync(summaryFile,bytes(report));assert.notEqual(call('--require-pass').status,0);
 report.runId=runId;writeFileSync(summaryFile,bytes(report));writeFileSync(join(native,report.nativeOrigin.filename),'changed');mkdirSync(join(root,'desktop-catalog-progress'));writeFileSync(join(root,'desktop-catalog-progress/progress.json'),JSON.stringify({authoritative:false,tasks:TASKS.map(id=>({id,status:'PASS',durationMs:1}))}));assert.notEqual(call('--require-pass').status,0);
});
