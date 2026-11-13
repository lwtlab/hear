import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {createHash} from 'node:crypto';
import {makeDeb} from './linux-test-deb.mjs';
import { approvedCandidate, replayInput, validateCandidate, adaptObserver, installedOutcome, verifyInstallInput, requirePristine } from './linux-install.mjs';

const candidate=()=>({kind:'original-source-linux-candidate',platform:'linux-x64',distribution:'unsigned-deb-ci-candidate',
  source:{repository:'lwtlab/lwt-core',commit:approvedCandidate.source,appPath:'apps/hear'},workflowRef:approvedCandidate.workflow,
  runId:approvedCandidate.run,runAttempt:1,version:'2.0.0',inputs:{native:{coreRef:approvedCandidate.source,clean:true,platform:'linux',arch:'x64'}},
  assets:[{name:'AIHear-2.0.0-linux-amd64.deb',bytes:123,sha256:'a'.repeat(64)}],payload:{package:'aihear',version:'2.0.0',architecture:'amd64'},
  packaging:{identity:'original-AIHear',productionFusesPreserved:true,productionAfterPackPreserved:true},acceptance:{packagedUi:'NOT_RUN',ordinaryInstalledLaunch:'NOT_RUN',upgrade:'NOT_RUN',uninstall:'NOT_RUN',modelRecovery:'NOT_RUN',systemAudio:'NOT_RUN',physicalAudio:'NOT_RUN',signedRepositoryDistribution:'NOT_RUN'}});
const build=()=>({id:approvedCandidate.run,run_attempt:1,head_sha:approvedCandidate.workflow,status:'completed',conclusion:'success',event:'workflow_dispatch',path:'.github/workflows/desktop-candidates.yml'});
test('replay selects only its reviewed source and successful exact build, without borrowed acceptance',()=>{
  assert.equal(replayInput({BUILD_MODE:'installed',SOURCE_REF:approvedCandidate.source}).sourceRef,approvedCandidate.source);
  assert.equal(validateCandidate(candidate(),build()).name,'AIHear-2.0.0-linux-amd64.deb');
  for(const changed of [{id:1},{run_attempt:2},{head_sha:'0'.repeat(40)},{status:'in_progress'},{conclusion:'failure'},{event:'pull_request'}])assert.throws(()=>validateCandidate(candidate(),{...build(),...changed}));
  for(const change of [r=>r.source.commit='0'.repeat(40),r=>r.kind='diagnostic',r=>r.acceptance.systemAudio='PASS',r=>r.acceptance={},r=>delete r.acceptance.modelRecovery,r=>r.inputs.native.clean=false,r=>r.assets[0].name='../outside.deb']){const r=candidate();change(r);assert.throws(()=>validateCandidate(r,build()));}
  for(const change of [{SOURCE_REF:'main'},{BUILD_MODE:'candidate'},{APP_REF:'a'.repeat(40)}])assert.throws(()=>replayInput({SOURCE_REF:approvedCandidate.source,BUILD_MODE:'installed',...change}));
});
test('observer adaptation is exact, keeps native quit/sandbox checks and uses isolated ordinary profile',()=>{
  const text=`import sys,os,re,subprocess\nfrom pathlib import Path\nfrom linux_process_flags import has_switch\nexe=Path('/opt/AIHearProbe/aihear-probe')\nresult = {'diagnostic': True, 'releaseAcceptance': False, 'arguments': [],\n 'package':'aihear-cross-platform-probe'}\nif True:\n    env = dict(os.environ)\n    child = subprocess.Popen([str(exe)], env=env)\n`;
  const actual=adaptObserver(text);assert(actual.includes('/opt/AIHear/aihear'));assert(actual.includes('--user-data-dir='));assert(actual.includes('TOKEN|SECRET'));
  assert(!actual.includes('AIHearProbe')&&!actual.includes('--no-sandbox'));
  execFileSync('python3',['-I','-c',"import sys;compile(sys.stdin.read(),'observer','exec')"],{input:actual});
  assert.throws(()=>adaptObserver(text+text));assert.throws(()=>adaptObserver(text.replace('env = dict(os.environ)','env = {}')));
});
test('installed gate rejects partial/forced exit, missing native quit and unsandboxed renderer evidence',()=>{
  const valid={status:'PASS',exitCode:0,package:'install ok installed 2.0.0',restrictedUserNamespaces:'1',appArmor:'aihear (unconfined)',window:'0x100',renderers:[{Seccomp:'2',NoNewPrivs:'1'}],quit:{method:'native XTEST Ctrl+Q',exitCode:0},arguments:['--user-data-dir=<task-owned>','--lang=en-US']};
  assert.equal(installedOutcome(valid,'2.0.0').status,'PASS');
  for(const changed of [{status:'FAIL'},{exitCode:-15},{quit:undefined},{restrictedUserNamespaces:'0'},{renderers:[]},{renderers:[{Seccomp:'0',NoNewPrivs:'0'}]},{arguments:[]}])assert.throws(()=>installedOutcome({...valid,...changed},'2.0.0'));
});
test('exact ZIP extraction validates real bytes and rejects linked, duplicate, oversized and unexpected members',t=>{
  const root=mkdtempSync(join(tmpdir(),'hear-original-zip-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const create=(file,entries)=>execFileSync('python3',['-I','-c',`import json,zipfile,sys\nr=json.load(sys.stdin)\nwith zipfile.ZipFile(sys.argv[1],'w')as z:\n for e in r:\n  i=zipfile.ZipInfo(e['name']);i.external_attr=e.get('mode',0o100644)<<16;z.writestr(i,e['data'])\n`,file],{input:JSON.stringify(entries),stdio:['pipe','pipe','pipe']});
  const script=new URL('./linux-candidate-zip.py',import.meta.url).pathname;
  const invoke=(entries,index)=>{const file=join(root,index+'.zip');create(file,entries);return spawnSync('python3',['-I',script,file,join(root,index+'-out')],{input:JSON.stringify({'candidate.json':2}),encoding:'utf8'});};
  assert.equal(invoke([{name:'candidate.json',data:'{}'}],'good').status,0);assert.equal(readFileSync(join(root,'good-out/candidate.json'),'utf8'),'{}');
  for(const [i,entries]of [
    [{name:'candidate.json',data:'{}',mode:0o120777}],
    [{name:'candidate.json',data:'{}'},{name:'candidate.json',data:'{}'}],
    [{name:'candidate.json',data:'{} ' }],
    [{name:'../candidate.json',data:'{}'}],
    [{name:'candidate.json',data:'{}'},{name:'private.txt',data:'no'}],
  ].entries())assert.notEqual(invoke(entries,String(i)).status,0);
});
test('frozen pre-root verifier consumes real deb bytes and blocks later changes before an install callback',t=>{
  const root=realpathSync(mkdtempSync(join(tmpdir(),'hear-pre-root-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root,'input'));mkdirSync(join(root,'receipt'));
  const data=Buffer.from('synthetic approved executable'),hook=Buffer.from('synthetic hook'),name='opt/AIHear/aihear',hookName='opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/linux-x64/node.napi.glibc.node';
  const file=join(root,'input',approvedCandidate.assetName);makeDeb(file,[{name,data:data.toString('base64')},{name:hookName,data:hook.toString('base64')}]);
  const r=candidate();r.assets[0]={name:approvedCandidate.assetName,bytes:readFileSync(file).length,sha256:hash(readFileSync(file))};
  r.payload={package:'aihear',version:'2.0.0',architecture:'amd64',payload:{[name]:{bytes:data.length,sha256:hash(data),mode:0o755}},hotkeyPrebuilds:{[hookName]:{bytes:hook.length,sha256:hash(hook),mode:0o755}}};
  const receipt=Buffer.from(JSON.stringify(r));writeFileSync(join(root,'receipt/candidate.json'),receipt);writeFileSync(join(root,'input/candidate.json'),receipt);
  const proof={approvedCandidate,buildRun:build(),receiptSha256:hash(receipt),asset:r.assets[0]};writeFileSync(join(root,'fetch.json'),JSON.stringify(proof));const frozen=hash(readFileSync(join(root,'fetch.json')));
  let installs=0;const install=()=>{const value=verifyInstallInput(root,frozen);installs++;return value;};assert.equal(install(),file);assert.equal(installs,1);
  const bytes=readFileSync(file);writeFileSync(file,Buffer.concat([bytes,Buffer.from('changed')]));assert.throws(install);assert.equal(installs,1);writeFileSync(file,bytes);
  writeFileSync(join(root,'input/candidate.json'),'{}');assert.throws(install);assert.equal(installs,1);writeFileSync(join(root,'input/candidate.json'),receipt);
  writeFileSync(join(root,'fetch.json'),'{}');assert.throws(install);assert.equal(installs,1);
});
test('pristine ownership check rejects regular paths and dangling links',t=>{
  const root=mkdtempSync(join(tmpdir(),'hear-pristine-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  requirePristine([join(root,'absent')]);const file=join(root,'file');writeFileSync(file,'existing');assert.throws(()=>requirePristine([file]));
  const link=join(root,'dangling');symlinkSync(join(root,'absent'),link);assert.throws(()=>requirePristine([link]));
});
test('installed replay is a separate artifact consumer and guards ownership before root installation',()=>{
  const text=readFileSync(new URL('../.github/workflows/desktop-candidates.yml',import.meta.url),'utf8'),job=text.split('\n  linux-installed:\n')[1];
  assert(job.includes("inputs.mode == 'installed'"));assert(job.includes('node ci/linux-install.mjs fetch'));assert(job.includes('node ci/assert-sources.mjs'));
  assert(job.indexOf('Verify source build')<job.indexOf('sudo apt-get'));
  assert(job.includes('test ! -L /opt/AIHear')&&job.includes('test ! -L /etc/apparmor.d/aihear'));assert(job.indexOf('node ci/linux-install.mjs verify')<job.indexOf('touch "$RUNNER_TEMP/hear-original-install/install-owned"'));assert(job.includes('EXPECTED_FETCH_SHA: ${{ steps.fetch.outputs.fetch_sha }}'));assert(job.indexOf('test ! -e /opt/AIHear')<job.indexOf('touch "$RUNNER_TEMP/hear-original-install/install-owned"'));
  assert(job.includes('node ci/private-step.mjs installed-original'));assert(job.includes('sudo dpkg --remove aihear'));assert(!job.includes('native-build')&&!job.includes('--no-sandbox'));
});
