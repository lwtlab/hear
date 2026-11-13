// Original application code/identity, production gates, Linux-only packaging adaptation.
// No diagnostic product identity, runtime overrides, signing bypass or publication.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFileSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourcePaths } from './dispatch.mjs';
import { productionDesktopConfig } from './desktop-candidate-config.mjs';

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const jsonValue = value => JSON.parse(value);
const json = file => jsonValue(readFileSync(file));
const regular = file => {
  assert(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), 'Regular input required');
  assert.equal(realpathSync(file), resolve(file), 'Input traverses a symlink');
};
const shaPattern = /^[a-f0-9]{40}$/;
export function linuxInputs(env, platform = process.platform, arch = process.arch) {
  assert.equal(platform, 'linux'); assert.equal(arch, 'x64');
  assert.equal(env.BUILD_MODE, 'candidate');
  assert(shaPattern.test(env.SOURCE_REF ?? ''), 'Full monorepo source required');
  assert(!env.APP_REF && !env.CORE_REF, 'Historical paired sources are not Linux candidates');
  return { sourceRef: env.SOURCE_REF, layout: 'monorepo', appPath: 'core/apps/hear', appRef: env.SOURCE_REF, coreRef: env.SOURCE_REF };
}

export function linuxConfig(base) {
  const config = productionDesktopConfig(base);
  // The Mac source configuration deliberately drops other-platform hotkey prebuilds.
  // Adapt only the target selection; all source exclusion and privacy rules survive.
  config.files = base.files.filter(entry => typeof entry !== 'string' || !entry.includes('uiohook-napi/prebuilds/'));
  config.files.push('!**/node_modules/uiohook-napi/prebuilds/*/**', '**/node_modules/uiohook-napi/prebuilds/linux-x64/**');
  config.directories = { ...base.directories, output: 'release/linux-original' };
  config.extraMetadata = { ...base.extraMetadata, name: 'aihear', homepage: 'https://github.com/lwtlab/hear' };
  config.linux = { target: ['deb'], executableName: 'aihear', category:'Utility',
    executableArgs: [], maintainer:'lwtlab <help@thucydides.net>', artifactName:'AIHear-${version}-linux-amd64.${ext}' };
  // Retain the standard builder runtime dependencies and path-scoped AppArmor hooks.
  config.deb = { fpm: ['--depends','fonts-noto-cjk','--depends','pulseaudio-utils','--depends','libpulse0'] };
  config.publish = null;
  assert.equal(config.afterPack, base.afterPack);
  assert.deepEqual(config.electronFuses, base.electronFuses);
  return config;
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd:root, encoding:'utf8', timeout:30000, stdio:['ignore','pipe','pipe'] }).trim();
}

export function collectLinux({ workspace, source, workflow, run, attempt }) {
  assert(shaPattern.test(source) && shaPattern.test(workflow));
  for (const value of [run,attempt]) assert(Number.isSafeInteger(value) && value>0);
  const core=join(workspace,'core'), desktop=join(core,'apps/hear/apps/desktop');
  assert.equal(git(workspace,'rev-parse','HEAD'),workflow);
  assert.equal(git(workspace,'status','--porcelain','--untracked-files=no'),'','Tracked public policy changed');
  assert.equal(git(core,'rev-parse','HEAD'),source);
  assert.equal(git(core,'status','--porcelain=v1','--untracked-files=normal'),'','Source changed during package build');
  const originFile=join(core,'hear-core/native-origin.json'), nativeFile=join(core,'hear-core/hear-core.linux-x64-gnu.node');
  regular(originFile); regular(nativeFile);
  const native=json(originFile);
  assert.equal(native.kind,'hear-native-build'); assert.equal(native.coreRef,source); assert.equal(native.clean,true);
  assert.equal(native.platform,'linux'); assert.equal(native.arch,'x64'); assert.equal(native.napi,'10');
  assert.equal(native.filename,basename(nativeFile)); assert.equal(sha(nativeFile),native.sha256);
  const elf=readFileSync(nativeFile);
  assert(elf.length>20 && elf.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])) && elf[4]===2 && elf[5]===1 && elf.readUInt16LE(18)===62, 'ELF x64 native required');
  const bin=join(desktop,'resources/bin/linux-x64');
  const inputs={ native:{kind:native.kind,coreRef:source,clean:true,platform:'linux',arch:'x64',napi:native.napi,filename:native.filename,sha256:native.sha256}, engines:[] };
  for(const name of ['myserver-ggml','myserver-sv','ffmpeg/ffmpeg','pulse-capture/hear-pulse-capture','qwen3/reader-qwen3-asr']) {
    const file=join(bin,name);regular(file);assert(lstatSync(file).mode&0o111);
    inputs.engines.push({name,bytes:lstatSync(file).size,sha256:sha(file)});
  }
  const qwen=json(join(bin,'qwen3/hear-stage.json')), recordFile=join(core,'.llama-build/upstream-cpu/reader-build.json'), record=json(recordFile);
  assert.equal(qwen.platform,'linux');assert.equal(qwen.arch,'x64');
  assert.equal(record.platform,'linux');assert.equal(record.arch,'x64');assert.equal(record.backend,'cpu');
  assert.equal(record.runtime,'upstream-asr');assert.equal(record.revision,json(join(core,'native/reader-models/models.lock.json')).upstreamRevision);
  const adapters=['runtime-files.mjs','CMakeLists.txt','main.cpp','request.h','aligner.h','aligner-text.h','compat/prepare.py','compat/qwen3a-legacy.inc','compat/preprocess.inc','compat/mask.inc','compat/q6-legacy.inc'].map(name=>'native/qwen3-asr/'+name);
  assert.deepEqual(new Set(Object.keys(record.adapterFiles??{})),new Set(adapters),'Complete reviewed ASR adapter set required');
  for(const [file,digest]of Object.entries(record.adapterFiles)) {
    assert(!file.startsWith('/') && !file.split(/[\\/]/).includes('..'));
    regular(join(core,file));assert.equal(sha(join(core,file)),digest);
  }
  for(const [name,digest]of Object.entries(qwen.staged)) {
    assert.equal(basename(name),name);regular(join(bin,'qwen3',name));assert.equal(sha(join(bin,'qwen3',name)),digest);
    assert.equal(record.files[name],digest,'Linux staged runtime must match source build');
  }
  const staged=json(join(bin,'qwen3/reader-build.json'));
  assert.equal(staged.buildRecordSha256,sha(recordFile));
  assert.deepEqual(new Set(Object.keys(qwen.staged)),new Set(Object.keys(record.files)));
  inputs.qwen={upstreamRevision:record.revision,backend:'cpu',buildRecordSha256:sha(recordFile),adapterSetSha256:createHash('sha256').update(JSON.stringify(record.adapterFiles)).digest('hex'),staged:qwen.staged};
  const release=join(desktop,'release/linux-original');
  const version=json(join(desktop,'package.json')).version;assert(/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version));
  const name=`AIHear-${version}-linux-amd64.deb`, file=join(release,name);regular(file);
  const assets=[{name,bytes:lstatSync(file).size,sha256:sha(file)}];assert(assets[0].bytes>0);
  const policyFile=join(release,'packaging-input.json');regular(policyFile);
  const packaging=json(policyFile);assert.equal(packaging.source,source);assert.equal(packaging.workflow,workflow);
  assert.equal(packaging.sourceConfigSha256,sha(join(desktop,'electron-builder.direct.yml')));assert.equal(packaging.adapterSha256,sha(import.meta.filename));
  assert.equal(packaging.platform,'linux-x64');assert.equal(packaging.productionFusesPreserved,true);assert.equal(packaging.productionAfterPackPreserved,true);
  const payloadRoot='opt/AIHear/resources', expected={};
  expected[`${payloadRoot}/app.asar.unpacked/node_modules/@lwtlab/hear-core/${native.filename}`]=native.sha256;
  for(const entry of inputs.engines) expected[`${payloadRoot}/resources/bin/linux-x64/${entry.name}`]=entry.sha256;
  for(const [name,digest]of Object.entries(qwen.staged)) expected[`${payloadRoot}/resources/bin/linux-x64/qwen3/${name}`]=digest;
  const unpacked=join(release,'linux-unpacked');
  for(const [sourceFile,target] of [[join(unpacked,'resources/app.asar'),`${payloadRoot}/app.asar`],[join(unpacked,'aihear'),'opt/AIHear/aihear']]) {regular(sourceFile);expected[target]=sha(sourceFile);}
  const payload=jsonValue(execFileSync('python3',[join(import.meta.dirname,'linux-deb-payload.py'),file],{input:JSON.stringify(expected),encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:1024*1024}));
  for(const path of ['opt/AIHear/aihear',...inputs.engines.map(entry=>`${payloadRoot}/resources/bin/linux-x64/${entry.name}`)]) assert(payload.payload[path].mode&0o111,'Packaged executable mode was lost');
  assert.equal(payload.package,'aihear');assert.equal(payload.version,version);assert.equal(payload.architecture,'amd64');
  assert.equal(sha(file),assets[0].sha256,'Deb changed during payload inspection');
  const result={schemaVersion:1,kind:'original-source-linux-candidate',source:{repository:'lwtlab/lwt-core',commit:source,appPath:'apps/hear'},
    product:'AIHear',version,platform:'linux-x64',distribution:'unsigned-deb-ci-candidate',workflowRef:workflow,runId:run,runAttempt:attempt,
    assets,inputs,payload,packaging:{...packaging,receiptSha256:sha(policyFile)},
    acceptance:{packagedUi:'NOT_RUN',ordinaryInstalledLaunch:'NOT_RUN',upgrade:'NOT_RUN',uninstall:'NOT_RUN',modelRecovery:'NOT_RUN',systemAudio:'NOT_RUN',physicalAudio:'NOT_RUN',signedRepositoryDistribution:'NOT_RUN'}};
  const output=join(workspace,'linux-candidate');mkdirSync(output,{mode:0o700});
  copyFileSync(file,join(output,name));assert.equal(sha(join(output,name)),assets[0].sha256);
  writeFileSync(join(output,'candidate.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  return result;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  const mode=process.argv[2];assert(['package','collect'].includes(mode));
  assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
  const workspace=resolve(import.meta.dirname,'..'), paths=sourcePaths(), app=join(workspace,paths.app),core=join(workspace,paths.core), desktop=join(app,'apps/desktop'), workflow=git(workspace, 'rev-parse','HEAD');
  assert.equal(process.env.SOURCE_LAYOUT,'monorepo');assert.equal(workflow,process.env.GITHUB_SHA);
  assert.equal(git(workspace,'status','--porcelain','--untracked-files=no'),'','Tracked public policy changed');
  assert.equal(git(core,'rev-parse','HEAD'),process.env.SOURCE_REF);
  if(mode==='collect')collectLinux({workspace,source:process.env.SOURCE_REF,workflow,run:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT)});
  else {
    const require=createRequire(join(desktop,'package.json')), br=createRequire(require.resolve('electron-builder')), lib=createRequire(br.resolve('app-builder-lib'));
    const baseFile=join(desktop,'electron-builder.direct.yml'), base=lib('js-yaml').load(readFileSync(baseFile,'utf8')), config=linuxConfig(base);
    const temporary=mkdtempSync(join(tmpdir(),'hear-linux-builder-')), file=join(temporary,'config.json');
    const configBytes=JSON.stringify(config);writeFileSync(file,configBytes,{flag:'wx',mode:0o600});
    const sourceBefore=git(core,'status','--porcelain=v1','--untracked-files=normal');assert.equal(sourceBefore,'');
    try {
      execFileSync(process.execPath,[require.resolve('electron-builder/out/cli/cli.js'),'--linux','deb','--x64','--config',file,'-p','never'],{cwd:desktop,env:{...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'},stdio:'inherit',timeout:300000});
      assert.equal(git(core,'status','--porcelain=v1','--untracked-files=normal'),'');
      const out=join(desktop,'release/linux-original');
      writeFileSync(join(out,'packaging-input.json'),JSON.stringify({source:process.env.SOURCE_REF,workflow,platform:'linux-x64',
        sourceConfigSha256:sha(baseFile),derivedConfigSha256:createHash('sha256').update(configBytes).digest('hex'),
        adapterSha256:sha(import.meta.filename),productionFusesPreserved:true,productionAfterPackPreserved:true,
        identity:'original-AIHear',overrides:['linux-deb-target-and-dependencies','linux-hotkey-prebuild','artifact-directory-and-filename','package-metadata','publication-disabled']},null,2)+'\n',{flag:'wx',mode:0o600});
    } finally {rmSync(temporary,{recursive:true,force:true});}
  }
 } catch(error) {
   appendFileSync(join(process.env.RUNNER_TEMP??tmpdir(),'hear-private.log'),String(error.stack??error)+'\n',{mode:0o600});
   console.error('Linux candidate failed; inspect encrypted diagnostics. No acceptance was produced.');
   process.exitCode=1;
 }
}
