import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,realpathSync,mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {windowsInputs,windowsConfig,validatePe,sevenZipEntries,payloadProof,collectWindows} from './windows-candidate.mjs';
import {productionDesktopConfig,validateFuseWire,REQUIRED_FUSES} from './desktop-candidate-config.mjs';
function base(){return {appId:'net.thucydides.lwt.hear',productName:'AIHear',afterPack:'scripts/after-pack.js',electronFuses:{...REQUIRED_FUSES},files:['out/**','!**/source/**','!**/node_modules/uiohook-napi/prebuilds/*/**','**/node_modules/uiohook-napi/prebuilds/darwin-arm64/**'],extraResources:[{from:'resources',to:'resources'}],asarUnpack:['**/node_modules/@lwtlab/**']};}
test('Windows input refuses paired/partial source, other platforms and noncandidate modes',()=>{const env={SOURCE_REF:'a'.repeat(40),BUILD_MODE:'candidate'};assert.equal(windowsInputs(env,'win32','x64').sourceRef,env.SOURCE_REF);for(const change of [{SOURCE_REF:'main'},{APP_REF:'b'.repeat(40)},{CORE_REF:'b'.repeat(40)},{BUILD_MODE:'checks'}])assert.throws(()=>windowsInputs({...env,...change},'win32','x64'));assert.throws(()=>windowsInputs(env,'linux','x64'));assert.throws(()=>windowsInputs(env,'win32','arm64'));});
test('Windows target preserves source identity, afterPack, security fuses and exclusions',()=>{const source=base(),saved=structuredClone(source),c=windowsConfig(source);assert.deepEqual(source,saved);assert.deepEqual(c.electronFuses,source.electronFuses);assert.equal(c.afterPack,source.afterPack);assert(c.files.includes('!**/source/**'));assert(c.files.includes('**/node_modules/uiohook-napi/prebuilds/win32-x64/**'));assert(!c.files.some(s=>s.includes('prebuilds/darwin')));assert.equal(c.nsis.runAfterFinish,false);assert.equal(c.nsis.deleteAppDataOnUninstall,false);assert.equal(c.publish,null);assert.equal(c.directories.output,'release/windows-original');for(const key of Object.keys(REQUIRED_FUSES)){const bad=base();bad.electronFuses[key]=!bad.electronFuses[key];assert.throws(()=>windowsConfig(bad));}const bad=base();bad.afterPack='bypass';assert.throws(()=>productionDesktopConfig(bad));});
function pe(machine=0x8664,dll=false){const b=Buffer.alloc(256);b.write('MZ');b.writeUInt32LE(64,60);b.write('PE\0\0',64);b.writeUInt16LE(machine,68);b.writeUInt16LE(dll?0x2000:0,86);b.writeUInt16LE(machine===0x8664?0x20b:0x10b,88);return b;}
test('actual payload requires x64 PE32+ while NSIS bootstrap may be x86',()=>{assert.equal(validatePe(pe()).machine,'x64');assert.equal(validatePe(pe(0x8664,true),{dll:true}).dll,true);assert.equal(validatePe(pe(0x14c),{installer:true}).machine,'x86');assert.throws(()=>validatePe(pe(0x14c)));assert.throws(()=>validatePe(pe(),{dll:true}));assert.throws(()=>validatePe(Buffer.alloc(4)));assert.throws(()=>validatePe(pe(0xaa64)));const b=pe();b.writeUInt32LE(10000,60);assert.throws(()=>validatePe(b));});
const listing=path=>`7-Zip\n--\nType = Nsis\n\n----------\nPath = ${path}\nSize = 12\nAttributes = A\n`;
test('payload listing accepts bounded ordinary paths and rejects traversal, duplicates and links',()=>{assert.deepEqual(sevenZipEntries(listing('$PLUGINSDIR/app-64.7z')),[{path:'$PLUGINSDIR/app-64.7z',directory:false,bytes:12}]);for(const name of ['../escape','C:\\outside','/outside','folder/../escape','folder//escape'])assert.throws(()=>sevenZipEntries(listing(name)));assert.throws(()=>sevenZipEntries(listing('safe')+'\nPath = safe\nSize = 1\n'));assert.throws(()=>sevenZipEntries(listing('safe')+'Symbolic Link = target\n'));assert.throws(()=>sevenZipEntries(listing('safe').replace('Size = 12','Size = 9999999999999')));});
test('actual fuse states must retain all six hardened production settings',()=>{const wire={version:'1',0:48,2:48,3:48,4:49,5:49,7:48};assert.deepEqual(validateFuseWire(wire),REQUIRED_FUSES);for(const index of [0,2,3,4,5,7]){const bad={...wire,[index]:wire[index]===48?49:48};assert.throws(()=>validateFuseWire(bad));}assert.throws(()=>validateFuseWire({...wire,version:'2'}));});
test('workflow retains original source, complete native staging, privacy and no capture/release',()=>{const yaml=readFileSync(new URL('../.github/workflows/desktop-candidates.yml',import.meta.url),'utf8'),job=yaml.split('\n  windows:\n')[1];assert(job);for(const text of ['windows-2025','persist-credentials: false','scripts/ci-core.sh','scripts/build-myserver.sh','build-reader-llama.mjs --backend cpu','scripts/build-ffmpeg-lgpl.sh','scripts/stage-all.mjs','windows-candidate.mjs" package','windows-candidate.mjs collect','retention-days: 14'])assert(job.includes(text));assert(!job.includes('windows-owned-audio'));assert(!job.includes('release create'));assert(!job.includes('--allow-missing'));assert(!job.includes('continue-on-error: true'));assert.match(yaml,/inputs.target != 'linux-x64' && inputs.target != 'win32-x64'/);});

// Generated tool/payload controls exercise the real extraction and byte comparison seam.
// These are unit controls, never evidence that a genuine NSIS installer is accepted.
function payloadFixture(t,change=()=>{},initialPayload=null){
 const root=realpathSync(mkdtempSync(join(tmpdir(),'hear-win-payload-control-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const payload=initialPayload??{'AIHear.exe':'synthetic electron','resources/app.asar':'synthetic asar','resources/native.node':'synthetic native'};
 const expected=Object.fromEntries(Object.entries(payload).map(([name,data])=>[name,createHash('sha256').update(typeof data==='string'?data:Buffer.from(data.base64,'base64')).digest('hex')]));
 const control={payload};change(control);const controlFile=join(root,'control.json');writeFileSync(controlFile,JSON.stringify(control));
 const seven=join(root,'7z-control');writeFileSync(seven,String.raw`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const c=JSON.parse(fs.readFileSync(${JSON.stringify(controlFile)}));const args=process.argv.slice(2),outer=args[2]?.endsWith('.exe')||args[1]?.endsWith('.exe');
function listing(rows){console.log('Type = '+(outer?'Nsis':'7z')+'\n\n----------\n'+rows.map(([name,size])=>'Path = '+name+'\nSize = '+size+'\nFolder = -').join('\n\n'));}
if(args[0]==='l')listing(outer?[['$PLUGINSDIR/app-64.7z',7]]:Object.entries(c.payload).map(([name,data])=>[name,Buffer.byteLength(typeof data==='string'?data:Buffer.from(data.base64,'base64'))]));
else{const out=args.find(s=>s.startsWith('-o')).slice(2),entries=outer?{'$PLUGINSDIR/app-64.7z':'archive'}:c.payload;for(const [name,data]of Object.entries(entries)){const file=path.join(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof data==='string'?data:Buffer.from(data.base64,'base64'));}}
`);chmodSync(seven,0o700);const installer=join(root,'AIHear.exe');writeFileSync(installer,'generated installer stub');return {root,installer,seven,expected};
}
test('actual payload extraction compares all expected original bytes',t=>{const f=payloadFixture(t),result=payloadProof(f.installer,f.expected,f.seven);assert.equal(result.memberCount,3);assert.equal(Object.keys(result.files).length,3);});
for(const [name,change]of [
 ['swapped native bytes',c=>{c.payload['resources/native.node']='different native';}],
 ['missing native bytes',c=>{delete c.payload['resources/native.node'];}],
 ['foreign hotkey platform',c=>{c.payload['resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/darwin-arm64/a.node']='foreign';}],
 ['traversal',c=>{c.payload['../escape']='bad';}],
 ['case-colliding files',c=>{c.payload['AIHEAR.exe']='collision';}],
 ['Windows alternate stream',c=>{c.payload['resources/native.node:stream']='bad';}],
 ['file ancestor',c=>{c.payload['resources']='bad';}],
])test('actual payload rejects '+name,t=>{const f=payloadFixture(t,change);assert.throws(()=>payloadProof(f.installer,f.expected,f.seven));});

test('Windows payload uses the locked uiohook-napi prebuild filename',()=>{const source=readFileSync(new URL('./windows-candidate.mjs',import.meta.url),'utf8');assert(source.includes('prebuilds/win32-x64/uiohook-napi.node'));assert(!source.includes('uiohook_napi.node'));});

function candidateFixture(t,mutate=()=>{}){
 const payload={},f=payloadFixture(t,()=>{},payload),root=f.root;
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const put=(name,data)=>{const file=join(root,name);mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,data);return file;};
 const hash=data=>createHash('sha256').update(data).digest('hex');
 const pe=(dll=false,x86=false)=>{const b=Buffer.alloc(256);b.write('MZ');b.writeUInt32LE(64,60);b.write('PE\0\0',64);b.writeUInt16LE(x86?0x14c:0x8664,68);b.writeUInt16LE(dll?0x2000:2,86);b.writeUInt16LE(x86?0x10b:0x20b,88);return b;};
 const core=join(root,'core'),desktop='core/apps/hear/apps/desktop',bin=desktop+'/resources/bin/win32-x64',release=desktop+'/release/windows-original',unpacked=release+'/win-unpacked';
 mkdirSync(core);for(const path of [root,core])git(path,'init');put('marker','generated public fixture');git(root,'add','marker');git(root,'-c','user.name=Control','-c','user.email=control@example.invalid','commit','-m','public');const workflow=git(root,'rev-parse','HEAD');
 put('core/.gitignore','hear-core/\n.llama-build/\napps/hear/apps/desktop/resources/bin/\napps/hear/apps/desktop/release/\napps/hear/apps/desktop/node_modules/\n');
 put(desktop+'/package.json','{"version":"2.0.0"}');const config='generated source config';put(desktop+'/electron-builder.direct.yml',config);put('core/native/reader-models/models.lock.json',JSON.stringify({upstreamRevision:'b'.repeat(40)}));
 const adapters={};for(const name of ['runtime-files.mjs','CMakeLists.txt','main.cpp','request.h','aligner.h','aligner-text.h','compat/prepare.py','compat/qwen3a-legacy.inc','compat/preprocess.inc','compat/mask.inc','compat/q6-legacy.inc']){const file='native/qwen3-asr/'+name,data='generated '+name;put('core/'+file,data);adapters[file]=hash(data);}
 git(core,'add','.');git(core,'-c','user.name=Control','-c','user.email=control@example.invalid','commit','-m','source');const source=git(core,'rev-parse','HEAD');
 const addPayload=(name,data)=>{payload[name]={base64:Buffer.from(data).toString('base64')};};
 const nativeName='hear-core.win32-x64-msvc.node',native=pe(true);put('core/hear-core/'+nativeName,native);put('core/hear-core/native-origin.json',JSON.stringify({schemaVersion:1,kind:'hear-native-build',coreRef:source,clean:true,platform:'win32',arch:'x64',napi:'10',filename:nativeName,sha256:hash(native)}));
 addPayload('resources/app.asar.unpacked/node_modules/@lwtlab/hear-core/'+nativeName,native);
 const staged={};for(const name of ['myserver-ggml.exe','myserver-sv.exe','ffmpeg/ffmpeg.exe','qwen3/reader-qwen3-asr.exe','qwen3/ggml.dll']){const data=pe(name.endsWith('.dll'));put(bin+'/'+name,data);addPayload('resources/resources/bin/win32-x64/'+name,data);if(name.startsWith('qwen3/'))staged[name.slice(6)]=hash(data);}
 const record=JSON.stringify({platform:'win32',arch:'x64',backend:'cpu',runtime:'upstream-asr',revision:'b'.repeat(40),adapterFiles:adapters,files:staged});put('core/.llama-build/upstream-cpu/reader-build.json',record);
 for(const [name,data]of Object.entries({'qwen3/hear-stage.json':JSON.stringify({platform:'win32',arch:'x64',staged}),'qwen3/reader-build.json':JSON.stringify({buildRecordSha256:hash(record)})})){put(bin+'/'+name,data);addPayload('resources/resources/bin/win32-x64/'+name,data);}
 for(const [name,data]of [['AIHear.exe',pe()],['resources/app.asar',Buffer.from('generated asar')],['resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node',pe(true)]]){put(unpacked+'/'+name,data);addPayload(name,data);}
 put(desktop+'/node_modules/electron-builder/index.js','module.exports={}');put(desktop+'/node_modules/app-builder-lib/index.js','module.exports={}');put(desktop+'/node_modules/@electron/fuses/index.js','exports.getCurrentFuseWire=async()=>('+JSON.stringify({version:'1',0:48,2:48,3:48,4:49,5:49,7:48})+')');
 put(release+'/AIHear-2.0.0-win-x64.exe',pe(false,true));put(release+'/packaging-input.json',JSON.stringify({source,workflow,platform:'win32-x64',productionFusesPreserved:true,productionAfterPackPreserved:true,sourceConfigSha256:hash(config),adapterSha256:hash(readFileSync(new URL('./windows-candidate.mjs',import.meta.url))),policyModuleSha256:hash(readFileSync(new URL('./desktop-candidate-config.mjs',import.meta.url)))}));
 mutate({payload,put,core});writeFileSync(join(root,'control.json'),JSON.stringify({payload}));return {workspace:root,source,workflow,run:12,attempt:1,seven:f.seven};
}
test('complete Windows collector binds generated installer to source, engines, full staging and NOT_RUN acceptance',async t=>{const f=candidateFixture(t),r=await collectWindows(f);assert.equal(r.kind,'original-source-windows-candidate');assert(Object.values(r.acceptance).every(s=>s==='NOT_RUN'));assert.equal(r.installerBootstrap.machine,'x86');assert.equal(r.inputs.native.clean,true);assert.equal(r.inputs.stagedFiles.length,7);assert.equal(Object.keys(r.payload.files).length,11);});
for(const [name,mutate]of [
 ['actual installer native substitution',f=>{f.payload['resources/app.asar.unpacked/node_modules/@lwtlab/hear-core/hear-core.win32-x64-msvc.node']={base64:Buffer.from('bad native').toString('base64')};}],
 ['x86 FFmpeg DLL',f=>{const b=Buffer.alloc(256);b.write('MZ');b.writeUInt32LE(64,60);b.write('PE\0\0',64);b.writeUInt16LE(0x14c,68);b.writeUInt16LE(0x2000,86);b.writeUInt16LE(0x10b,88);f.put('core/apps/hear/apps/desktop/resources/bin/win32-x64/ffmpeg/avcodec.dll',b);f.payload['resources/resources/bin/win32-x64/ffmpeg/avcodec.dll']={base64:b.toString('base64')};}],
 ['actual staged DLL substitution',f=>{f.payload['resources/resources/bin/win32-x64/qwen3/ggml.dll']='bad DLL';}],
 ['public tracked policy drift',f=>{f.put('marker','changed');}],
 ['private source drift',f=>{f.put('core/apps/hear/apps/desktop/package.json','{"version":"3.0.0"}');}],
 ['native origin digest mismatch',f=>{f.put('core/hear-core/hear-core.win32-x64-msvc.node','wrong');}],
 ['missing actual Windows hotkey filename',f=>{delete f.payload['resources/app.asar.unpacked/node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node'];}],
])test('complete Windows collector rejects '+name,async t=>{const f=candidateFixture(t,mutate);await assert.rejects(()=>collectWindows(f));});

test('Windows pinned-source initialization preserves LF bytes despite autocrlf=true',t=>{
 const workflow=readFileSync(new URL('../.github/workflows/desktop-candidates.yml',import.meta.url),'utf8').split('  windows:')[1];assert(workflow.includes('asr-source core git submodule update --init --recursive -- apps/hear/apps/desktop/vendor/whisper.cpp'));assert(workflow.includes('qwen-source core git -c core.autocrlf=false -c core.eol=lf -c submodule.third_party/'));assert(!workflow.includes('asr-source core git -c core.autocrlf=false'));
 const root=realpathSync(mkdtempSync(join(tmpdir(),'hear-win-checkout-control-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),origin=join(root,'origin');mkdirSync(origin);git(origin,'init');writeFileSync(join(origin,'clip.cpp'),'first line\nsecond line\n');git(origin,'add','.');git(origin,'-c','user.name=Control','-c','user.email=control@example.invalid','commit','-m','source');const head=git(origin,'rev-parse','HEAD');
 const outcomes=[];for(const mode of ['default','canonical']){const parent=join(root,mode);mkdirSync(parent);git(parent,'init');git(parent,'config','core.autocrlf','true');writeFileSync(join(parent,'.gitmodules'),'[submodule "pinned"]\n path = pinned\n url = '+origin+'\n');git(parent,'add','.gitmodules');git(parent,'update-index','--add','--cacheinfo','160000,'+head+',pinned');
 git(parent,'-c','protocol.file.allow=always',...(mode==='canonical'?['-c','core.autocrlf=false','-c','core.eol=lf']:['-c','core.autocrlf=true']),'submodule','update','--init','--recursive','--','pinned');outcomes.push(readFileSync(join(parent,'pinned/clip.cpp')));}
 assert(outcomes[0].includes(Buffer.from('\r\n')));assert.equal(outcomes[1].toString(),'first line\nsecond line\n');
});
