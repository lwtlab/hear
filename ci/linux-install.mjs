// Acceptance replays one separately built original application. Never rebuild or relabel it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const approvedCandidate=Object.freeze({source:'bc70b6098d45e47359f6b26359d668d2c4323ba4',workflow:'380567188b8f8058186bb837c546dc1896bdd170',run:43347562223,attempt:1,version:'2.0.0',assetName:'AIHear-2.0.0-linux-amd64.deb'});
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const read=file=>JSON.parse(readFileSync(file));
const digest=value=>createHash('sha256').update(value).digest('hex');
const publicFiles=[import.meta.filename,join(import.meta.dirname,'linux-candidate-zip.py'),join(import.meta.dirname,'linux-deb-payload.py')],publicTools=()=>Object.fromEntries(publicFiles.map(file=>[file,sha(file)])),publicBefore=publicTools();
const regular=file=>assert(lstatSync(file).isFile()&&!lstatSync(file).isSymbolicLink()&&realpathSync(file)===resolve(file));
export function replayInput(env){
  assert.equal(env.BUILD_MODE,'installed');assert.equal(env.SOURCE_REF,approvedCandidate.source);assert(!env.APP_REF&&!env.CORE_REF);
  return {layout:'monorepo',appPath:'core/apps/hear',sourceRef:approvedCandidate.source,appRef:approvedCandidate.source,coreRef:approvedCandidate.source};
}
export function validateCandidate(candidate,run){
  assert.equal(run.id,approvedCandidate.run);assert.equal(run.run_attempt,approvedCandidate.attempt);
  assert.equal(run.head_sha,approvedCandidate.workflow);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
  assert.equal(run.event,'workflow_dispatch');assert.equal(run.path,'.github/workflows/desktop-candidates.yml');
  assert.equal(candidate.kind,'original-source-linux-candidate');assert.equal(candidate.platform,'linux-x64');assert.equal(candidate.distribution,'unsigned-deb-ci-candidate');
  assert.deepEqual(candidate.source,{repository:'lwtlab/lwt-core',commit:approvedCandidate.source,appPath:'apps/hear'});
  assert.equal(candidate.workflowRef,approvedCandidate.workflow);assert.equal(candidate.runId,approvedCandidate.run);assert.equal(candidate.runAttempt,approvedCandidate.attempt);
  assert.equal(candidate.inputs.native.coreRef,approvedCandidate.source);assert.equal(candidate.inputs.native.clean,true);
  assert.equal(candidate.inputs.native.platform,'linux');assert.equal(candidate.inputs.native.arch,'x64');
  assert.equal(candidate.version,approvedCandidate.version);
  assert.equal(candidate.assets.length,1);const asset=candidate.assets[0];assert(/^AIHear-\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?-linux-amd64\.deb$/.test(asset.name));
  assert(Number.isSafeInteger(asset.bytes)&&asset.bytes>0&&asset.bytes<1024**3&&/^[a-f0-9]{64}$/.test(asset.sha256));
  assert.equal(asset.name,approvedCandidate.assetName);assert.equal(asset.name,`AIHear-${candidate.version}-linux-amd64.deb`);
  assert.equal(candidate.payload.package,'aihear');assert.equal(candidate.payload.version,candidate.version);assert.equal(candidate.payload.architecture,'amd64');
  assert.equal(candidate.packaging.identity,'original-AIHear');assert(candidate.packaging.productionAfterPackPreserved&&candidate.packaging.productionFusesPreserved);
  assert.deepEqual(candidate.acceptance,{packagedUi:'NOT_RUN',ordinaryInstalledLaunch:'NOT_RUN',upgrade:'NOT_RUN',uninstall:'NOT_RUN',modelRecovery:'NOT_RUN',systemAudio:'NOT_RUN',physicalAudio:'NOT_RUN',signedRepositoryDistribution:'NOT_RUN'},'Complete unexecuted acceptance boundary required');
  return asset;
}
export function requirePristine(paths){
  for(const path of paths){let present=true;try{lstatSync(path);}catch(e){if(e.code==='ENOENT')present=false;else throw e;}assert(!present,'Refuse pre-existing installation or link');}
}
export function verifyInstallInput(root,expectedFetchSha){
  assert(/^[a-f0-9]{64}$/.test(expectedFetchSha??''),'Frozen fetch digest required');
  const fetchFile=join(root,'fetch.json');regular(fetchFile);assert.equal(sha(fetchFile),expectedFetchSha,'Fetch proof changed');
  const proof=read(fetchFile);assert.deepEqual(proof.approvedCandidate,approvedCandidate);
  const receipt=join(root,'receipt/candidate.json'),copy=join(root,'input/candidate.json');regular(receipt);regular(copy);
  assert.equal(sha(receipt),proof.receiptSha256);assert(readFileSync(receipt).equals(readFileSync(copy)));
  const candidate=read(receipt),asset=validateCandidate(candidate,proof.buildRun);assert.deepEqual(asset,proof.asset);
  assert.deepEqual(readdirSync(join(root,'input')).sort(),['candidate.json',asset.name].sort());
  const file=join(root,'input',asset.name);regular(file);assert.equal(lstatSync(file).size,asset.bytes);assert.equal(sha(file),asset.sha256);
  const expected=Object.fromEntries(Object.entries(candidate.payload.payload).map(([name,value])=>[name,value.sha256]));
  const payload=JSON.parse(execFileSync('python3',['-I',join(import.meta.dirname,'linux-deb-payload.py'),file],{input:JSON.stringify(expected),encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}));
  assert.deepEqual(payload,candidate.payload);assert.equal(sha(file),asset.sha256);assert.equal(sha(fetchFile),expectedFetchSha);
  return file;
}
function unique(text,from,to){assert.equal(text.split(from).length,2,'Reviewed observer structure changed');return text.replace(from,to);}
export function adaptObserver(source){
  source=source.replaceAll('aihear-cross-platform-probe','aihear').replaceAll('AIHearProbe','AIHear').replaceAll('aihear-probe','aihear');
  source=unique(source,'from linux_process_flags import has_switch','sys.path.insert(0, str(Path(__file__).resolve().parent))\nfrom linux_process_flags import has_switch');
  source=unique(source,"child = subprocess.Popen([str(exe)],", "child = subprocess.Popen([str(exe), '--user-data-dir=' + str(out / 'profile'), '--lang=en-US'],");
  source=unique(source,"result = {'diagnostic': True, 'releaseAcceptance': False, 'arguments': [],", "result = {'diagnostic': True, 'releaseAcceptance': False, 'arguments': ['--user-data-dir=<task-owned>', '--lang=en-US'],");
  source=unique(source,'env = dict(os.environ)',`env = dict(os.environ)
    for key in list(env):
        if re.search(r'^DYLD_|^LD_|^HEAR_|^READER_|TOKEN|SECRET|API_KEY|PASSWORD|CREDENTIAL|^AWS_|^S3_', key):
            env.pop(key, None)`);
  return source;
}
export function installedOutcome(result,version){
  assert.equal(result.status,'PASS');assert.equal(result.exitCode,0);assert.equal(result.package,'install ok installed '+version);
  assert.equal(result.restrictedUserNamespaces,'1');assert(result.appArmor.startsWith('aihear '));
  assert(result.window&&Array.isArray(result.renderers)&&result.renderers.length>0);
  assert(result.renderers.every(r=>r.Seccomp==='2'&&r.NoNewPrivs==='1'));
  assert.equal(result.quit?.method,'native XTEST Ctrl+Q');assert.equal(result.quit.exitCode,0);
  assert.deepEqual(result.arguments,['--user-data-dir=<task-owned>','--lang=en-US']);
  return {status:'PASS',ordinaryInstalledLaunch:'PASS',nativeQuit:'PASS',sandbox:'PASS',profile:'task-owned-fresh',
    window:result.window,rendererCount:result.renderers.length,readyMs:result.readyMs,
    boundary:'GitHub Linux VM/Xvfb; no model inference, system audio, physical hardware, upgrade, uninstall or signed repository acceptance'};
}

const api=endpoint=>JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']}));
function download(artifact,root,label){
  assert.equal(artifact.expired,false);assert(Number.isSafeInteger(artifact.id)&&artifact.id>0);
  assert(Number.isSafeInteger(artifact.size_in_bytes)&&artifact.size_in_bytes>0&&artifact.size_in_bytes<1024**3);
  assert(/^sha256:[a-f0-9]{64}$/.test(artifact.digest));
  const file=join(root,label+'.zip'),fd=openSync(file,'wx',0o600);
  try{execFileSync('gh',['api',`repos/lwtlab/hear/actions/artifacts/${artifact.id}/zip`],{stdio:['ignore',fd,'pipe'],timeout:180000});}finally{closeSync(fd);}
  regular(file);assert.equal(lstatSync(file).size,artifact.size_in_bytes);assert.equal('sha256:'+sha(file),artifact.digest);return file;
}
function unpack(file,destination,expected){execFileSync('python3',['-I',join(import.meta.dirname,'linux-candidate-zip.py'),file,destination],{input:JSON.stringify(expected),stdio:['pipe','pipe','pipe'],timeout:180000});}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.notEqual(process.getuid(),0);
  const workspaceRoot=resolve(import.meta.dirname,'..');assert.equal(execFileSync('git',['-C',workspaceRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.GITHUB_SHA);execFileSync('git',['-C',workspaceRoot,'diff','--quiet','HEAD','--','ci','.github/workflows'],{stdio:'pipe'});assert.deepEqual(publicTools(),publicBefore);
  const mode=process.argv[2];assert(['fetch','verify','observe'].includes(mode));
  const root=join(realpathSync(process.env.RUNNER_TEMP),'hear-original-install');
  if(mode==='fetch'){
    mkdirSync(root,{mode:0o700});const run=api(`repos/lwtlab/hear/actions/runs/${approvedCandidate.run}`);
    assert.equal(run.head_sha,approvedCandidate.workflow);assert.equal(run.run_attempt,approvedCandidate.attempt);assert.equal(run.conclusion,'success');
    const rows=JSON.parse(execFileSync('gh',['api','--paginate','--slurp',`repos/lwtlab/hear/actions/runs/${approvedCandidate.run}/artifacts?per_page=100`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000})).flatMap(p=>p.artifacts);
    const one=name=>{const found=rows.filter(a=>a.name===name);assert.equal(found.length,1);return found[0];};
    const receiptArtifact=one(`hear-linux-candidate-receipt-${approvedCandidate.run}-${approvedCandidate.attempt}`);
    const receiptZip=download(receiptArtifact,root,'receipt');
    // ZIP directory inspection returns only the bounded size; archive paths are not extracted.
    const size=Number(execFileSync('python3',['-I','-c',"import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);i=z.infolist();assert len(i)==1 and i[0].filename=='candidate.json';assert 0<i[0].file_size<2*1024**2;print(i[0].file_size)",receiptZip],{encoding:'utf8'}));
    const receipt=join(root,'receipt');unpack(receiptZip,receipt,{'candidate.json':size});const candidateFile=join(receipt,'candidate.json'),candidate=read(candidateFile),asset=validateCandidate(candidate,run);
    const packageArtifact=one(`hear-linux-x64-${approvedCandidate.run}-${approvedCandidate.attempt}`),packageZip=download(packageArtifact,root,'package');
    const input=join(root,'input');unpack(packageZip,input,{'candidate.json':size,[asset.name]:asset.bytes});
    assert(readFileSync(candidateFile).equals(readFileSync(join(input,'candidate.json'))));assert.equal(sha(join(input,asset.name)),asset.sha256);
    const expected=Object.fromEntries(Object.entries(candidate.payload.payload).map(([name,v])=>[name,v.sha256]));
    const payload=JSON.parse(execFileSync('python3',['-I',join(import.meta.dirname,'linux-deb-payload.py'),join(input,asset.name)],{input:JSON.stringify(expected),encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}));
    assert.deepEqual(payload,candidate.payload);
    const fetchFile=join(root,'fetch.json');writeFileSync(fetchFile,JSON.stringify({approvedCandidate,publicTools:publicBefore,buildRun:Object.fromEntries(['id','run_attempt','head_sha','status','conclusion','event','path'].map(key=>[key,run[key]])),receiptArtifact,packageArtifact,receiptSha256:sha(candidateFile),asset},null,2),{flag:'wx',mode:0o600});
    appendFileSync(process.env.GITHUB_OUTPUT,'fetch_sha='+sha(fetchFile)+'\n');
  }else if(mode==='verify'){
    requirePristine(['/opt/AIHear','/etc/apparmor.d/aihear']);verifyInstallInput(root,process.env.EXPECTED_FETCH_SHA);
  }else{
    verifyInstallInput(root,process.env.EXPECTED_FETCH_SHA);
    const workspace=resolve(import.meta.dirname,'..'),core=join(workspace,'core'),scripts=join(core,'apps/hear/scripts'),candidate=read(join(root,'receipt/candidate.json'));
    assert.equal(execFileSync('git',['-C',core,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),approvedCandidate.source);
    const observerFile=join(scripts,'linux-installed-smoke.py'),flagsFile=join(scripts,'linux_process_flags.py');regular(observerFile);regular(flagsFile);
    assert.equal(sha(observerFile),'dd36a9416f2be7e2090e8ec4099cbd5a0e96e0fab7a27fb732f18ebb379f1f15');assert.equal(sha(flagsFile),'15f09ceb0e31e2ed88dd80e36c2c7a3d80b67de915157869f223cf8e00e7d13e');
    const installedFiles={...candidate.payload.payload,...candidate.payload.hotkeyPrebuilds};
    for(const [name,value] of Object.entries(installedFiles)){const file='/'+name;regular(file);assert.equal(lstatSync(file).uid,0);assert.equal(sha(file),value.sha256);}
    const observerBytes=readFileSync(observerFile),flagsBytes=readFileSync(flagsFile);assert.equal(digest(observerBytes),sha(observerFile));assert.equal(digest(flagsBytes),sha(flagsFile));
    const observer=join(root,'observer');mkdirSync(observer,{mode:0o700});const derived=adaptObserver(observerBytes.toString('utf8'));
    writeFileSync(join(observer,'ordinary.py'),derived,{flag:'wx',mode:0o600});writeFileSync(join(observer,'linux_process_flags.py'),flagsBytes,{flag:'wx',mode:0o600});
    const evidence=join(root,'evidence');mkdirSync(join(evidence,'profile'),{recursive:true,mode:0o700});
    writeFileSync(join(evidence,'profile/audio.json'),JSON.stringify({mic:{enabled:false,gain:0},system:{enabled:false,gain:0,source:{kind:'system'}}}),{flag:'wx',mode:0o600});
    writeFileSync(join(evidence,'profile/ui.json'),JSON.stringify({lang:'en',onboarding:{onboardedVersion:1}}),{flag:'wx',mode:0o600});
    const runtimeFile=join(core,'scripts/verify-runtime.mjs'),runtimeBytes=readFileSync(runtimeFile);assert.equal(digest(runtimeBytes),'d9bab01d1d42c6bef7e6305a7beb40c62cc4e011174eb3354204fe8dc9367417');
    const tools=()=>({adapter:sha(import.meta.filename),originalObserver:sha(observerFile),adaptedObserver:sha(join(observer,'ordinary.py')),flags:sha(join(observer,'linux_process_flags.py')),originalFlags:sha(flagsFile),runtime:sha(runtimeFile)}),before=tools();
    assert.equal(before.originalObserver,digest(observerBytes));assert.equal(before.flags,digest(flagsBytes));assert.equal(before.runtime,digest(runtimeBytes));
    const {runCommand}=await import('data:text/javascript;base64,'+runtimeBytes.toString('base64'));assert.deepEqual(tools(),before);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);let runtime;
    try{runtime=await runCommand(['xvfb-run','--auto-servernum','python3','-I',join(observer,'ordinary.py'),evidence,'--native-quit'],{cwd:root,env:process.env,signal:controller.signal,output:bytes=>{const log=join(process.env.RUNNER_TEMP,'hear-private.log');assert((existsSync(log)?lstatSync(log).size:0)+bytes.length<32*1024*1024);appendFileSync(log,bytes,{mode:0o600});}});}finally{clearTimeout(timer);}
    writeFileSync(join(root,'owned-runtime.json'),JSON.stringify(runtime,null,2),{flag:'wx',mode:0o600});assert.equal(runtime.code,0);assert(!runtime.signal&&!runtime.reason&&!controller.signal.aborted);assert.deepEqual(tools(),before);
    const reportFile=join(evidence,'ordinary-launch.json'),report=read(reportFile),outcome=installedOutcome(report,candidate.version);
    for(const pid of [report.pid,...report.renderers.map(r=>r.pid)]){let alive=false;try{process.kill(pid,0);alive=true;}catch(e){assert.equal(e.code,'ESRCH');}assert(!alive,'Owned PID still present or reused');}
    for(const [name,value]of Object.entries(installedFiles))assert.equal(sha('/'+name),value.sha256);
    const result={schemaVersion:1,kind:'original-linux-installed-observation',source:approvedCandidate.source,appPath:'apps/hear',build:approvedCandidate,
      qa:{workflow:process.env.GITHUB_SHA,run:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT)},
      fetchReceiptSha256:sha(join(root,'fetch.json')),candidateReceiptSha256:sha(join(root,'receipt/candidate.json')),rawObservationSha256:sha(reportFile),
      tools:before,publicTools:Object.fromEntries(Object.entries(publicBefore).map(([file,value])=>[file.split('/').at(-1),value])),ownedRuntimeSha256:sha(join(root,'owned-runtime.json')),...outcome};
    writeFileSync(join(workspace,'installed-observation.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  }
  assert.deepEqual(publicTools(),publicBefore);execFileSync('git',['-C',workspaceRoot,'diff','--quiet','HEAD','--','ci','.github/workflows'],{stdio:'pipe'});
 }catch(error){appendFileSync(join(process.env.RUNNER_TEMP,'hear-private.log'),String(error.stack??error)+'\n',{mode:0o600});console.error('Original Linux installation replay failed; consult encrypted diagnostics.');process.exitCode=1;}
}
