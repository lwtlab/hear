// Optional shared native/GUI gate; signed packages, models and audio remain separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptLog } from './log-crypto.mjs';

export const TASKS = ['hear-tools','hear-types','hear-unit','core-sources','core-asr-controls','hear-native','hear-gui'];
export const DEPENDENCIES = [[],['hear-tools'],['hear-types'],[],['core-sources'],['hear-tools','core-asr-controls'],['hear-native','hear-unit']];
export const POLICY = 'reader-hear-source-execution-v1';
export const CONTRACT = '677f68bdf7fb8c8aae2e0764a0cd0df0ed491b86416d2f59834448f6915052fe';
export const GRAPH = '8c9143e65fdc143ce34e97ae8d16afbea6a023745de4b63d412a587248d27e03';
export const PINS = {
  "scripts/verify-hear.mjs": "8fd6737471ea3ddeea6bb530afa0520f27eff02b2aa7232d0cda67d2bc243c39",
  "scripts/verify-hear-progress.mjs": "6dc15dc589dca09305247629faaf6b632b7af5022dbb50f5a75d7247d7a66109",
  "scripts/hear-native.mjs": "c202936d2d7059e74fbf6d36025ed4b04318e85289b4d65facd45e0948ad1162",
  "scripts/verification-execution.mjs": "c9ff6cf3fb37bffd87eb68d9cff054a916d676b959d017248b0899a95610e78c",
  "scripts/verify-reuse.mjs": "76a80842b4f91b111ac7e4cb4f915ce31a57c496e067b116c492bc49b9137ae9",
  "scripts/verify-runtime.mjs": "d9bab01d1d42c6bef7e6305a7beb40c62cc4e011174eb3354204fe8dc9367417",
  "scripts/verification-catalog.mjs": "d76f0617729d80ed40c4707c7d4d41f26ef27370d8c813ddd00db967b0e9e49a",
  "scripts/verification-cpu-tasks.mjs": "a5ed5d7c5601b9af72d17d1b45a16a5f4f8ca21016622743687c15362517b958",
  "scripts/verify-tasks.mjs": "ed75ec8b8c609597c16f6dcbcc7ee622211e5e3f7d31869fc70e6663295b39b3",
  "scripts/hear.sh": "3d12b95c35186ea1aab6599ebd52d32b495e1c20d1b0e7d2fd28c59fc2a12574",
  "scripts/hear-check.mjs": "d80ee9e7d2c45ba5a3e341cad1a7200c251fde14a09755e797bdbd92f1157ad7",
  "apps/hear/scripts/ci-core.sh": "50ede347998f0a379b6ead08a9e937e3b0f8be3055300e75a9cd7b314451f168",
  "hear-core/scripts/build.sh": "652c89dff330a63b09a883ea25d2d3c0c2766538d5e55394e13018517aac84a0"
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = value => /^[a-f0-9]{64}$/.test(value ?? '');
const duration = value => Number.isSafeInteger(value) && value >= 0 && value <= 75*60*1000;
export function checkedBinding(value) {
  for(const key of ['headRef','baseRef','testedRef','workflowRef'])assert.match(value[key]??'',/^[a-f0-9]{40}$/);
  for(const key of ['prNumber','runId','runAttempt'])assert(Number.isSafeInteger(value[key])&&value[key]>0);
  assert.equal(value.platform,'darwin-arm64');
  return Object.fromEntries(['headRef','baseRef','testedRef','workflowRef','prNumber','runId','runAttempt','platform'].map(key=>[key,value[key]]));
}
function ordinary(file,maximum) {
  const info=lstatSync(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=maximum);return readFileSync(file);
}
export function verifyImplementation(core) {
  core=realpathSync(core);assert.equal(Object.keys(PINS).length,13);
  for(const [name,hash]of Object.entries(PINS)) {
    const file=join(core,name);assert.equal(realpathSync(file),file);assert.equal(digest(ordinary(file,1024*1024)),hash,'Changed desktop executor graph');
  }
}
export function validatePlan(plan) {
  const {contractSha256,...definition}=plan;
  assert.equal(contractSha256,CONTRACT);assert.equal(digest(JSON.stringify(definition)),CONTRACT);
  assert.equal(plan.scope,'hear-desktop');assert.equal(plan.profile,'full');assert.equal(plan.policy,POLICY);assert.equal(plan.selectionApplied,false);assert.deepEqual(plan.executionPlatforms,['darwin']);
  assert.equal(digest(JSON.stringify(plan.tasks)),GRAPH);assert.deepEqual(plan.tasks.map(task=>task.id),TASKS);
  assert.deepEqual(plan.tasks.map(task=>task.dependencies),DEPENDENCIES);
  return plan;
}
function checkedNative(value,binding) {
  assert.deepEqual(Object.keys(value).sort(),['schemaVersion','kind','coreRef','clean','platform','arch','napi','filename','sha256'].sort());
  assert.equal(value.schemaVersion,1);assert.equal(value.kind,'hear-native-build');assert.equal(value.coreRef,binding.testedRef);assert.equal(value.clean,true);
  assert.equal(value.platform,'darwin');assert.equal(value.arch,'arm64');assert.equal(value.napi,'10');assert.equal(value.filename,'hear-core.darwin-arm64.node');assert(hex(value.sha256));
  return value;
}
export function desktopResult(bytes,identity,execution,startedAt,native=null,now=Date.now()) {
  const binding=checkedBinding(identity);
  const result={schemaVersion:1,kind:'hear-shared-desktop-verification',diagnostic:true,releaseAcceptance:false,...binding,appPath:'apps/hear',policy:POLICY,scope:'hear-desktop',profile:'full',selectionApplied:false,contractSha256:CONTRACT,executorGraphSha256:digest(JSON.stringify(PINS)),summarySha256:null,nativeOrigin:null,status:'FAIL',validation:'FAIL',executionOutcome:['success','failure','cancelled','skipped'].includes(execution)?execution:'unknown',tasks:TASKS.map(id=>({id,status:'NOT_RUN',durationMs:null})),tests:{unit:null,gui:null},preparationDurationMs:null,executionDurationMs:null,acceptance:{nativeCompilation:'NOT_RUN',scriptedGui:'NOT_RUN',modelInference:'NOT_RUN',signedInstallation:'NOT_RUN',physicalAudio:'NOT_RUN'}};
  try {
    assert(Buffer.isBuffer(bytes)&&bytes.length<=2*1024*1024);const report=JSON.parse(bytes);
    assert.equal(report.schemaVersion,1);assert.equal(report.kind,'hear-desktop-verification');assert.equal(report.scope,'hear-desktop');assert.equal(report.profile,'full');
    assert.match(report.runId??'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.equal(report.environmentPolicy,'hear-desktop-defaults-v1');
    assert.deepEqual(report.host,{platform:'darwin',arch:'arm64',node:'v24.22.0'});
    assert.equal(report.source.head,binding.testedRef);assert.equal(report.source.dirty,false);assert.deepEqual(report.source,report.sourceAfter);assert(hex(report.source.inputHash));
    assert(hex(report.inputs.sha256));assert.equal(report.inputs.sha256,report.inputsAfter.sha256);assert.equal(report.inputs.taskGraphSha256,GRAPH);assert.equal(report.inputsAfter.taskGraphSha256,GRAPH);
    assert.deepEqual(report.tasks.map(task=>task.id),TASKS);
    const coverage=report.catalogExecution;assert.equal(coverage.policy,POLICY);assert.equal(coverage.scope,'hear-desktop');assert.equal(coverage.profile,'full');assert.equal(coverage.selectionApplied,false);assert.equal(coverage.contractSha256,CONTRACT);assert.deepEqual(coverage.tasks,report.tasks.map(({id,status})=>({id,status})));
    const begin=Date.parse(report.startedAt),end=Date.parse(report.endedAt);assert(Number.isSafeInteger(startedAt)&&begin>=startedAt-1000&&end>=begin&&end<=now+1000);assert(duration(report.durationMs)&&report.durationMs===end-begin);
    for(const [index,task]of report.tasks.entries()) {
      assert(['PASS','FAIL','NOT_RUN'].includes(task.status));assert(duration(task.durationMs));
      if(task.status==='PASS'){assert.equal(task.exitCode,0);assert(DEPENDENCIES[index].every(id=>report.tasks.find(task=>task.id===id).status==='PASS'));}
      if(task.status==='FAIL')assert(task.exitCode!==0);
      if(['hear-unit','hear-gui'].includes(task.id)&&task.status==='PASS') {
        assert(Number.isSafeInteger(task.tests?.passed)&&task.tests.passed>0);assert.equal(task.tests.failed,0);assert(Array.isArray(task.tests.skipped));
        result.tests[task.id==='hear-unit'?'unit':'gui']={passed:task.tests.passed,failed:0,skipped:task.tests.skipped.length};
      }
    }
    assert.equal(coverage.status,report.tasks.every(task=>task.status==='PASS')?'PASS':report.tasks.some(task=>task.status==='FAIL')?'FAIL':'INCOMPLETE');
    result.validation='PASS';result.summarySha256=digest(bytes);result.tasks=report.tasks.map(({id,status,durationMs})=>({id,status,durationMs}));result.preparationDurationMs=Math.max(0,begin-startedAt);result.executionDurationMs=report.durationMs;
    if(execution==='success'&&report.status==='PASS'&&coverage.status==='PASS'&&!['failure','sourceFailure','cleanupFailure','executionFailure','nativeFailure'].some(key=>report[key])) {
      checkedNative(native,binding);assert.deepEqual(report.nativeOrigin,native);
      assert.deepEqual(report.acceptance,{nativeCompilation:'PASS',scriptedGui:'PASS',signedInstallation:'NOT_RUN',physicalAudio:'NOT_RUN',modelInference:'NOT_RUN'});
      result.nativeOrigin=native;result.status='PASS';result.acceptance.nativeCompilation='PASS';result.acceptance.scriptedGui='PASS';
    }
  } catch { /* Missing, reused or unbound execution cannot supply desktop success. */ }
  return result;
}
function readReport() {
  const core=realpathSync('core'),directory=join(core,'.artifacts/hear-verify');assert.equal(realpathSync(directory),directory);
  const folders=readdirSync(directory);assert(!folders.includes('running.lock'));assert.equal(folders.length,1);assert.match(folders[0],/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const folder=join(directory,folders[0]);assert.equal(realpathSync(folder),folder);
  return ordinary(join(folder,'summary.json'),2*1024*1024);
}
function nativeProof(binding) {
  const core=realpathSync('core'),base=join(core,'hear-core');assert.equal(realpathSync(base),base);assert(!existsSync(join(base,'hear-core.darwin-universal.node')));
  const origin=checkedNative(JSON.parse(ordinary(join(base,'native-origin.json'),65536)),binding),file=join(base,origin.filename);assert.equal(realpathSync(file),file);
  const bytes=ordinary(file,256*1024*1024);assert.equal(digest(bytes),origin.sha256);return {origin,bytes};
}
async function main() {
  const mode=process.argv[2];assert(process.argv.length===3&&['--start','--verify-input','--collect','--require-pass'].includes(mode));
  const binding=checkedBinding({headRef:process.env.HEAD_REF,baseRef:process.env.BASE_REF,testedRef:process.env.TESTED_REF,workflowRef:process.env.GITHUB_SHA,prNumber:Number(process.env.PR_NUMBER),runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),platform:`${process.platform}-${process.arch}`});
  const startFile='desktop-catalog-start.json',resultFile='desktop-catalog-receipt/verification.json';
  if(mode==='--start') {
    assert(!process.env.DESKTOP_APP_REF&&!process.env.DESKTOP_CORE_REF);for(const key of ['DESKTOP_FUNCTIONAL_RUNTIME','DESKTOP_REUSE_NATIVE','DESKTOP_REUSE_RUNTIME','DESKTOP_WINDOWS_SIGNAL'])assert.equal(process.env[key],'false');
    assert(!existsSync(startFile)&&!existsSync('desktop-catalog-receipt'));encryptLog(Buffer.from('desktop-catalog'),process.env.HEAR_LOG_PUBLIC_KEY);
    writeFileSync(startFile,JSON.stringify({binding,startedAt:Date.now()}),{mode:0o600});console.log('Explicit macOS native/scripted GUI scope; model, release and audio acceptance remain NOT_RUN');return;
  }
  const started=JSON.parse(ordinary(startFile,65536));assert.deepEqual(started.binding,binding);
  if(mode==='--verify-input') {
    verifyImplementation('core');
    const git=(...args)=>execFileSync('git',args,{cwd:'core',encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    assert.equal(git('status','--porcelain'),'');assert.equal(git('rev-parse','HEAD'),binding.testedRef);assert.equal(git('show','-s','--format=%P','HEAD'),`${binding.baseRef} ${binding.headRef}`);
    const bytes=execFileSync(process.execPath,['scripts/verification-execution.mjs','--scope','hear-desktop','--profile','full'],{cwd:'core',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:2*1024*1024});validatePlan(JSON.parse(bytes));console.log('Pinned desktop executor graph and immutable merge parents verified');return;
  }
  let bytes=null,native=null;try{bytes=readReport();native=nativeProof(binding);}catch{}
  const result=desktopResult(bytes,binding,process.env.DESKTOP_EXECUTION_OUTCOME,started.startedAt,native?.origin);
  const encrypted={summary:'desktop-summary.enc.json',native:'desktop-native.enc.json',log:'desktop-log.enc.json'};
  if(mode==='--collect') {
    assert(!existsSync('desktop-catalog-receipt'));mkdirSync('desktop-catalog-receipt');mkdirSync('diagnostics',{recursive:true});
    const log=join(process.env.RUNNER_TEMP,'hear-private.log');
    for(const [id,data]of Object.entries({summary:bytes,native:native?.bytes,log:existsSync(log)?ordinary(log,256*1024*1024):null})) if(data)writeFileSync(join('diagnostics',encrypted[id]),JSON.stringify(encryptLog(data,process.env.HEAR_LOG_PUBLIC_KEY)),{mode:0o600});
  }
  result.diagnostics=Object.fromEntries(Object.entries(encrypted).map(([id,file])=>[id,existsSync(join('diagnostics',file))?digest(ordinary(join('diagnostics',file),384*1024*1024)):null]));
  if(mode==='--collect'){writeFileSync(resultFile,JSON.stringify(result,null,2),{mode:0o600});console.log(`Shared desktop result: ${result.status}`);}
  else {assert.deepEqual(JSON.parse(ordinary(resultFile,65536)),result);assert.equal(result.status,'PASS');assert(Object.values(result.diagnostics).every(hex));console.log('Fresh shared native/scripted GUI receipt verified');}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Desktop catalog verification failed; inspect authenticated private diagnostics');process.exitCode=1;});
