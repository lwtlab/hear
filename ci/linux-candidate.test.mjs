import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { linuxConfig, linuxInputs, collectLinux } from './linux-candidate.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const base={appId:'net.thucydides.lwt.hear',productName:'AIHear',afterPack:'scripts/after-pack.js',
  files:['out/**','!**/*.map','!**/node_modules/@lwtlab/*/src/**','!**/node_modules/uiohook-napi/prebuilds/*/**','**/node_modules/uiohook-napi/prebuilds/darwin-arm64/**'],
  extraResources:[{from:'resources',to:'resources'}],asarUnpack:['**/node_modules/@lwtlab/**','**/node_modules/uiohook-napi/**'],
  directories:{output:'release',buildResources:'build'},electronFuses:{runAsNode:false,enableNodeOptionsEnvironmentVariable:false,enableNodeCliInspectArguments:false,enableEmbeddedAsarIntegrityValidation:true,onlyLoadAppFromAsar:true,grantFileProtocolExtraPrivileges:false}};
test('Linux packaging retains original identity, privacy hook, production fuses and non-platform file exclusions',()=>{
  const original=structuredClone(base),config=linuxConfig(base);assert.deepEqual(base,original);
  assert.equal(config.appId,base.appId);assert.equal(config.productName,base.productName);assert.equal(config.afterPack,base.afterPack);
  assert.deepEqual(config.electronFuses,base.electronFuses);assert.deepEqual(config.extraResources,base.extraResources);assert.deepEqual(config.asarUnpack,base.asarUnpack);
  assert.deepEqual(config.files.filter(s=>!s.includes('uiohook-napi/prebuilds/')),base.files.filter(s=>!s.includes('uiohook-napi/prebuilds/')));
  assert(config.files.includes('**/node_modules/uiohook-napi/prebuilds/linux-x64/**'));assert(!JSON.stringify(config.files).includes('darwin-arm64'));
  assert.equal(config.linux.artifactName,'AIHear-${version}-linux-amd64.${ext}');assert.deepEqual(config.linux.executableArgs,[]);assert.equal(config.publish,null);assert.equal(config.directories.output,'release/linux-original');
  for(const bad of [{...base,afterPack:undefined},{...base,electronFuses:{...base.electronFuses,runAsNode:true}},{...base,appId:'probe'}])assert.throws(()=>linuxConfig(bad));
});
test('Linux candidates require explicit monorepo source, candidate mode and native Linux x64',()=>{
  const env={SOURCE_REF:'a'.repeat(40),BUILD_MODE:'candidate'};assert.equal(linuxInputs(env,'linux','x64').coreRef,env.SOURCE_REF);
  for(const bad of [{SOURCE_REF:'main'},{BUILD_MODE:'checks'},{APP_REF:'b'.repeat(40)},{CORE_REF:'b'.repeat(40)}])assert.throws(()=>linuxInputs({...env,...bad},'linux','x64'));
  for(const target of [['darwin','arm64'],['linux','arm64'],['win32','x64']])assert.throws(()=>linuxInputs(env,...target));
});

function makeDeb(file,entries,fields='Package: aihear\nVersion: 2.0.0\nArchitecture: amd64\n') {
  const program=`import base64,io,json,tarfile,sys\nr=json.load(sys.stdin)\ndef tar(items):\n b=io.BytesIO()\n with tarfile.open(fileobj=b,mode='w:gz') as t:\n  for e in items:\n   i=tarfile.TarInfo(e['name']);i.mode=e.get('mode',0o755)\n   if e.get('directory'):i.type=tarfile.DIRTYPE;t.addfile(i)\n   elif e.get('link') is not None:i.type=tarfile.LNKTYPE if e.get('hardlink') else tarfile.SYMTYPE;i.linkname=e['link'];t.addfile(i)\n   else:\n    data=base64.b64decode(e['data']);i.size=len(data);t.addfile(i,io.BytesIO(data))\n return b.getvalue()\nwith open(sys.argv[1],'wb') as f:\n f.write(b'!<arch>\\n')\n for name,data in [('debian-binary',b'2.0\\n'),('control.tar.gz',tar([{'name':'control','data':base64.b64encode(r['fields'].encode()).decode()}])),('data.tar.gz',tar(r['entries']))]:\n  f.write((name+'/').ljust(16).encode()+b'0'.ljust(12)+b'0'.ljust(6)+b'0'.ljust(6)+b'100644'.ljust(8)+str(len(data)).ljust(10).encode()+b'\x60\\n'+data)\n  if len(data)%2:f.write(b'\\n')\n`;
  execFileSync('python3',['-c',program,file],{input:JSON.stringify({entries,fields})});
}
function fixture(t,mutatePayload=()=>{}) {
  const root=realpathSync(mkdtempSync(join(tmpdir(),'hear-linux-candidate-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put=(name,data)=>{const path=join(root,name);mkdirSync(join(path,'..'),{recursive:true});writeFileSync(path,data);return path;};
  for(const path of [root,join(root,'core')]){mkdirSync(path,{recursive:true});git(path,'init');}
  const desktop='core/apps/hear/apps/desktop',bin=desktop+'/resources/bin/linux-x64';
  put('marker','public fixture');git(root,'add','marker');git(root,'-c','user.email=test@example.invalid','-c','user.name=Test','commit','-m','public');
  const workflow=git(root,'rev-parse','HEAD');
  put('core/.gitignore','hear-core/\n.llama-build/\napps/hear/apps/desktop/resources/bin/\napps/hear/apps/desktop/release/\n');
  put(desktop+'/package.json','{"version":"2.0.0"}');put(desktop+'/electron-builder.direct.yml','synthetic source configuration');
  put('core/native/reader-models/models.lock.json',JSON.stringify({upstreamRevision:'b'.repeat(40)}));
  const adapterFiles={};for(const name of ['runtime-files.mjs','CMakeLists.txt','main.cpp','request.h','aligner.h','aligner-text.h','compat/prepare.py','compat/qwen3a-legacy.inc','compat/preprocess.inc','compat/mask.inc','compat/q6-legacy.inc']){
    const path='native/qwen3-asr/'+name,data='synthetic adapter '+name;put('core/'+path,data);adapterFiles[path]=hash(data);
  }
  git(join(root,'core'),'add','.');git(join(root,'core'),'-c','user.email=test@example.invalid','-c','user.name=Test','commit','-m','source');
  const source=git(join(root,'core'),'rev-parse','HEAD');
  const elf=Buffer.alloc(24);elf.set([0x7f,0x45,0x4c,0x46,2,1]);elf.writeUInt16LE(62,18);
  put('core/hear-core/hear-core.linux-x64-gnu.node',elf);
  put('core/hear-core/native-origin.json',JSON.stringify({kind:'hear-native-build',coreRef:source,clean:true,platform:'linux',arch:'x64',napi:'10',filename:'hear-core.linux-x64-gnu.node',sha256:hash(elf)}));
  const payload={'opt/AIHear/resources/app.asar.unpacked/node_modules/@lwtlab/hear-core/hear-core.linux-x64-gnu.node':elf};
  for(const name of ['myserver-ggml','myserver-sv','ffmpeg/ffmpeg','pulse-capture/hear-pulse-capture','qwen3/reader-qwen3-asr']){
    const data=Buffer.from('synthetic engine '+name);const path=put(bin+'/'+name,data);execFileSync('chmod',['755',path]);payload['opt/AIHear/resources/resources/bin/linux-x64/'+name]=data;
  }
  const runtimeFiles={'reader-qwen3-asr':hash(payload['opt/AIHear/resources/resources/bin/linux-x64/qwen3/reader-qwen3-asr'])};
  const record={platform:'linux',arch:'x64',backend:'cpu',runtime:'upstream-asr',revision:'b'.repeat(40),adapterFiles,files:runtimeFiles};
  const recordBytes=JSON.stringify(record);put('core/.llama-build/upstream-cpu/reader-build.json',recordBytes);
  put(bin+'/qwen3/hear-stage.json',JSON.stringify({platform:'linux',arch:'x64',staged:runtimeFiles}));
  put(bin+'/qwen3/reader-build.json',JSON.stringify({buildRecordSha256:hash(recordBytes)}));
  const release=desktop+'/release/linux-original';
  for(const [name,data,target]of [['resources/app.asar','synthetic asar','opt/AIHear/resources/app.asar'],['aihear','synthetic electron','opt/AIHear/aihear']]){
    put(release+'/linux-unpacked/'+name,data);payload[target]=Buffer.from(data);
  }
  put(release+'/packaging-input.json',JSON.stringify({source,workflow,platform:'linux-x64',productionFusesPreserved:true,productionAfterPackPreserved:true,sourceConfigSha256:hash('synthetic source configuration'),adapterSha256:hash(readFileSync(new URL('./linux-candidate.mjs',import.meta.url)))}));
  payload['opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/linux-x64/node.napi.glibc.node']=Buffer.from('synthetic hook');
  const entries=Object.entries(payload).map(([name,data])=>({name,data:data.toString('base64')}));mutatePayload(entries);
  const asset=join(root,release,'AIHear-2.0.0-linux-amd64.deb');makeDeb(asset,entries);
  return {root,source,workflow,asset,entries};
}
test('collector binds actual deb bytes to clean native/engine inputs and retains every installed gate NOT_RUN',t=>{
  const f=fixture(t),r=collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:2});
  assert.equal(r.payload.package,'aihear');assert.equal(r.payload.architecture,'amd64');assert.equal(r.distribution,'unsigned-deb-ci-candidate');
  assert.equal(r.assets.length,1);assert(Object.values(r.acceptance).every(s=>s==='NOT_RUN'));assert.equal(r.inputs.native.clean,true);assert.equal(r.inputs.native.coreRef,f.source);
  assert.equal(r.assets[0].sha256,hash(readFileSync(f.asset)));assert.equal(JSON.parse(readFileSync(join(f.root,'linux-candidate/candidate.json'))).runAttempt,2);
});
for(const [name,mutate]of [
  ['swapped packaged native',entries=>{entries.find(e=>e.name.endsWith('hear-core.linux-x64-gnu.node')).data=Buffer.from('wrong native').toString('base64');}],
  ['missing Linux hotkey',entries=>{entries.splice(entries.findIndex(e=>e.name.includes('uiohook-napi')),1);}],
  ['foreign hotkey directory',entries=>entries.push({name:'opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/darwin-arm64/',directory:true})],
  ['foreign hotkey prebuild',entries=>{entries.find(e=>e.name.includes('uiohook-napi')).name=entries.find(e=>e.name.includes('uiohook-napi')).name.replace('linux-x64','darwin-arm64');}],
  ['symlink native',entries=>{const e=entries.find(e=>e.name.endsWith('hear-core.linux-x64-gnu.node'));delete e.data;e.link='/unrelated/native.node';}],
  ['lost executable permission',entries=>{entries.find(e=>e.name.endsWith('qwen3/reader-qwen3-asr')).mode=0o644;}],
  ['parent symlink before payload',entries=>entries.unshift({name:'opt/AIHear/resources',link:'/unrelated'})],
  ['parent symlink after payload',entries=>entries.push({name:'opt/AIHear/resources',link:'/unrelated'})],
  ['parent hardlink',entries=>entries.push({name:'opt/AIHear',link:'usr/share/unrelated',hardlink:true})],
  ['regular-file ancestor',entries=>entries.push({name:'opt/AIHear/resources',data:'YQ=='})],
  ['duplicate payload',entries=>entries.push({...entries[0]})],
  ['unsafe path',entries=>entries.push({name:'../outside',data:'YQ=='})],
])test('real deb inspection rejects '+name,t=>{const f=fixture(t,mutate);assert.throws(()=>collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:1}));});
test('collector rejects tracked source drift before reading installer inputs',t=>{
  const f=fixture(t);writeFileSync(join(f.root,'core/apps/hear/apps/desktop/package.json'),'{"version":"9.0.0"}');
  assert.throws(()=>collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:1}));
});
test('standard desktop executable leaf link remains valid',t=>{
  const f=fixture(t,entries=>entries.push({name:'usr/bin/aihear',link:'/opt/AIHear/aihear'}));
  assert.equal(collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:1}).payload.package,'aihear');
});
test('native origin from a different private source cannot qualify a correct deb',t=>{
  const f=fixture(t),file=join(f.root,'core/hear-core/native-origin.json'),r=JSON.parse(readFileSync(file));r.coreRef='0'.repeat(40);writeFileSync(file,JSON.stringify(r));
  assert.throws(()=>collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:1}));
});
test('truncated ar payload cannot qualify',t=>{
  const f=fixture(t),bytes=readFileSync(f.asset);writeFileSync(f.asset,bytes.subarray(0,bytes.length-1));
  assert.throws(()=>collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:1}));
});
test('Linux job cannot become a diagnostic installer or bypass production packaging gates',()=>{
  const text=readFileSync(new URL('../.github/workflows/desktop-candidates.yml',import.meta.url),'utf8'),job=text.split('\n  linux:\n')[1];
  assert(job.includes("if: inputs.target == 'linux-x64'"));assert(job.indexOf('linuxInputs(process.env)')<job.indexOf('ssh-key:'));
  for(const line of ['scripts/ci-core.sh','scripts/build-reader-llama.mjs --backend cpu','scripts/stage-all.mjs','ci/linux-candidate.mjs" package','node ci/linux-candidate.mjs collect'])assert(job.includes(line));
  assert(!job.includes('platform-probe-package')&&!job.includes('--no-sandbox')&&!job.includes('release create'));
});

test('standard hotkey directory members remain valid while binary payload stays regular',t=>{
  const f=fixture(t,entries=>{
    entries.unshift({name:'opt/AIHear/resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/linux-x64/',directory:true});
  });
  assert.equal(collectLinux({workspace:f.root,source:f.source,workflow:f.workflow,run:12,attempt:1}).payload.package,'aihear');
});
