import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { sourceResult, SOURCE_CONTRACT, SOURCE_GRAPH, SOURCE_POLICY, SOURCE_TASKS } from './source-catalog.mjs';
import { decryptLog } from './log-crypto.mjs';

const binding = { sourceRef:'a'.repeat(40),workflowRef:'b'.repeat(40),runId:12,runAttempt:1,platform:`${process.platform}-${process.arch}` };
const runId='12345678-1234-1234-1234-123456789abc';
function fixture() {
  const source={head:binding.sourceRef,dirty:false,inputHash:'c'.repeat(64),submodules:[],privatePath:'PRIVATE-PATH'};
  const inputs={sha256:'d'.repeat(64),taskGraphSha256:SOURCE_GRAPH};
  const begin=Date.now()-1000;
  return {
    schemaVersion:1,kind:'hear-source-verification',runId,scope:'hear-source',profile:'full',status:'PASS',environmentPolicy:'hear-source-defaults-v1',host:{platform:process.platform,arch:process.arch,node:'v24.22.0'},
    source,sourceAfter:{...source},inputs,inputsAfter:{...inputs},startedAt:new Date(begin).toISOString(),endedAt:new Date(begin+100).toISOString(),durationMs:100,
    tasks:SOURCE_TASKS.map(id=>({id,status:'PASS',exitCode:0,durationMs:10,reason:'PRIVATE-DIAGNOSTIC',...(id==='hear-unit'?{tests:{passed:1,failed:0,skipped:[]}}:{})})),
    catalogExecution:{policy:SOURCE_POLICY,scope:'hear-source',profile:'full',selectionApplied:false,contractSha256:SOURCE_CONTRACT,status:'PASS',tasks:SOURCE_TASKS.map(id=>({id,status:'PASS'}))},
  };
}
const bytes = value => Buffer.from(JSON.stringify(value));
const result = (report, execution='success',started=Date.now()-10000) => sourceResult(bytes(report),binding,execution,started);
test('binds complete actual source coverage without publishing private report fields', () => {
  const report=fixture(),r=result(report);
  assert.equal(r.status,'PASS');assert.equal(r.validation,'PASS');assert.equal(r.selectionApplied,false);
  assert.deepEqual(r.tasks.map(t=>t.id),SOURCE_TASKS);assert(r.tasks.every(t=>t.durationMs===10));
  assert.equal(r.summarySha256,createHash('sha256').update(bytes(report)).digest('hex'));
  for(const text of ['PRIVATE-PATH','PRIVATE-DIAGNOSTIC'])assert(!JSON.stringify(r).includes(text));
  assert(Object.values(r.acceptance).every(value=>value==='NOT_RUN'));
});
test('incomplete, stale, reused, changed and unbound reports never supply a successful gate', () => {
  const report=fixture();
  for(const change of [
    {source:{...report.source,head:'e'.repeat(40)}}, {source:{...report.source,dirty:true}},
    {sourceAfter:{...report.source,head:'e'.repeat(40)}}, {inputsAfter:{...report.inputs,sha256:'e'.repeat(64)}},
    {inputs:{...report.inputs,taskGraphSha256:'e'.repeat(64)}},
    {catalogExecution:{...report.catalogExecution,contractSha256:'e'.repeat(64)}},
    {catalogExecution:{...report.catalogExecution,selectionApplied:true}},
    {tasks:report.tasks.slice(0,2)}, {tasks:[...report.tasks,report.tasks[0]]},
    {tasks:report.tasks.map(t=>({...t,status:'REUSED'}))},
    {tasks:report.tasks.map(t=>({...t,exitCode:1}))}, {tasks:report.tasks.map(t=>({...t,durationMs:undefined}))},
    {cleanupFailure:'PRIVATE-FAILURE'}, {status:'FAIL'},
  ])assert.equal(result({...report,...change}).status,'FAIL');
  assert.equal(result(report,'failure').status,'FAIL');
  assert.equal(result(report,'success',Date.now()+1000).status,'FAIL');
  assert.equal(sourceResult(null,binding,'skipped',Date.now()).status,'FAIL');
  assert.throws(()=>sourceResult(bytes(report),{...binding,sourceRef:'main'},'success',Date.now()-10000));
});
test('retains real failure/NOT_RUN outcomes without accepting a missing dependency', () => {
  const report=fixture();report.status='FAIL';report.tasks[1]={...report.tasks[1],status:'FAIL',exitCode:23};report.tasks[2]={...report.tasks[2],status:'NOT_RUN',exitCode:null,durationMs:0};
  report.catalogExecution.status='FAIL';report.catalogExecution.tasks=report.tasks.map(({id,status})=>({id,status}));
  const r=result(report,'failure');assert.equal(r.validation,'PASS');assert.equal(r.status,'FAIL');assert.deepEqual(r.tasks.map(t=>t.status),['PASS','FAIL','NOT_RUN']);
  report.tasks[2]={...report.tasks[2],status:'PASS',exitCode:0};report.catalogExecution.tasks=report.tasks.map(({id,status})=>({id,status}));
  assert.equal(result(report).validation,'FAIL');
});

function cliFixture(t) {
  const root=mkdtempSync(join(tmpdir(),'hear-source-ci-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});
  const env={...process.env,SOURCE_REF:binding.sourceRef,GITHUB_SHA:binding.workflowRef,GITHUB_RUN_ID:'12',GITHUB_RUN_ATTEMPT:'1',SOURCE_EXECUTION_OUTCOME:'success',HEAR_LOG_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'}),SOURCE_APP_REF:'',SOURCE_CORE_REF:''};
  for(const key of ['SOURCE_NATIVE_CHECK','SOURCE_FUNCTIONAL_RUNTIME','SOURCE_REUSE_NATIVE','SOURCE_REUSE_RUNTIME','SOURCE_WINDOWS_SIGNAL'])env[key]='false';
  const run=mode=>spawnSync(process.execPath,[join(import.meta.dirname,'source-catalog.mjs'),mode],{cwd:root,env,encoding:'utf8'});
  assert.equal(run('--start').status,0);
  const report=fixture();report.startedAt=new Date().toISOString();report.endedAt=report.startedAt;report.durationMs=0;
  report.tasks=report.tasks.map(task=>({...task,durationMs:0}));
  const directory=join(root,'core/.artifacts/hear-verify',runId);mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'summary.json'),bytes(report));
  return {root,keys,env,run,directory,report};
}
test('actual collector encrypts the report, publishes a bounded receipt and checks exact bytes', t => {
  const f=cliFixture(t);const collected=f.run('--collect');assert.equal(collected.status,0,collected.stderr);
  assert(!collected.stdout.includes('PRIVATE'));
  const published=JSON.parse(readFileSync(join(f.root,'source-catalog-receipt/verification.json')));assert.equal(published.status,'PASS');assert(!JSON.stringify(published).includes('PRIVATE'));
  const encrypted=JSON.parse(readFileSync(join(f.root,'diagnostics/source-execution.enc.json')));
  assert.deepEqual(decryptLog(encrypted,f.keys.privateKey),bytes(f.report));
  assert.equal(f.run('--require-pass').status,0);
  published.tasks[0].durationMs=999;writeFileSync(join(f.root,'source-catalog-receipt/verification.json'),JSON.stringify(published));assert.notEqual(f.run('--require-pass').status,0);
});
test('active locks cannot pass; invalid symlink bytes are neither read nor relayed', t => {
  const f=cliFixture(t);writeFileSync(join(f.root,'core/.artifacts/hear-verify/running.lock'),'');assert.equal(f.run('--collect').status,0);
  assert.equal(JSON.parse(readFileSync(join(f.root,'source-catalog-receipt/verification.json'))).status,'FAIL');assert.notEqual(f.run('--require-pass').status,0);
  const other=cliFixture(t);rmSync(join(other.directory,'summary.json'));writeFileSync(join(other.root,'private-source'),'PRIVATE-SENTINEL');symlinkSync(join(other.root,'private-source'),join(other.directory,'summary.json'));
  assert.equal(other.run('--collect').status,0);const r=JSON.parse(readFileSync(join(other.root,'source-catalog-receipt/verification.json')));assert.equal(r.status,'FAIL');assert.equal(r.summarySha256,null);
});
test('workflow source-only target is explicit and leaves the original probe intact', () => {
  const text=readFileSync(new URL('../.github/workflows/cross-platform-probe.yml',import.meta.url),'utf8');
  assert.match(text,/options: \[all, linux-x64, win32-x64, darwin-arm64, source-unix, desktop-macos\]/);
  assert.match(text,/source-catalog:\n\s+if: inputs.target == 'source-unix'/);
  assert.match(text,/probe:\n\s+if: inputs.target != 'source-unix'/);
  assert.match(text,/run: node ci\/private-step.mjs source-catalog core node scripts\/verify-hear.mjs --profile full/);
  assert.match(text,/name: hear-source-receipt-.*github.run_attempt/);
  assert.match(text,/run: node ci\/source-catalog.mjs --require-pass/);
});
