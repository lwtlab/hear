// A hosted runner may compile CUDA bytes without having the NVIDIA driver.
// Only that external driver can make CLI execution NOT_RUN; missing payload
// dependencies and every attempted CLI failure remain fatal.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync} from 'node:fs';
import {join,isAbsolute} from 'node:path';
export function loaderEnvironment(env){return Object.fromEntries(Object.entries(env).filter(([key])=>!/^LD_|^DYLD_/.test(key)));}
export function missingLinuxLibraries(output){
 const missing=[];
 for(const line of output.split('\n'))if(line.includes('not found')){const match=line.match(/^\s*([A-Za-z0-9_.+-]+)\s+=>\s+not found\s*$/);assert(match,'Unrecognized loader failure');missing.push(match[1]);}
 return [...new Set(missing)].sort();
}
export function inspectRuntimeLoad({exe,platform,env=process.env,run=spawnSync,systemRoot=env.SystemRoot}){
 assert(['linux','win32','darwin'].includes(platform));assert(isAbsolute(exe));
 const clean=loaderEnvironment(env),invoke=(command,args)=>{const result=run(command,args,{env:clean,encoding:'utf8',timeout:15000,killSignal:'SIGKILL',maxBuffer:256*1024,windowsHide:true});assert(!result.error&&!result.signal,'Runtime loader probe did not complete');return result;};
 if(platform==='linux'){
  const dependencies=invoke('/usr/bin/ldd',[exe]);assert.equal(dependencies.status,0,'Dependency inspection failed');const missing=missingLinuxLibraries(dependencies.stdout+'\n'+dependencies.stderr);
  assert(missing.every(name=>name==='libcuda.so.1'),'Missing non-driver runtime library: '+missing.join(','));
  if(missing.length)return {status:'NOT_RUN',reason:'NVIDIA_DRIVER_MISSING',driver:'libcuda.so.1'};
 }else if(platform==='win32'){
  assert(isAbsolute(systemRoot??''),'Windows system directory required');const directory=join(systemRoot,'System32');assert(lstatSync(directory).isDirectory());
  if(!existsSync(join(directory,'nvcuda.dll')))return {status:'NOT_RUN',reason:'NVIDIA_DRIVER_MISSING',driver:'nvcuda.dll'};
 }
 const help=invoke(exe,['--help']);assert.equal(help.status,0,'Staged CLI failed to load');return {status:'PASS',scope:'CLI_HELP_ONLY',gpuExecution:'NOT_RUN'};
}
export function validateRuntimeLoad(result,platform){
 if(result?.status==='PASS')assert.deepEqual(result,{status:'PASS',scope:'CLI_HELP_ONLY',gpuExecution:'NOT_RUN'});
 else{assert(['linux','win32'].includes(platform));assert.deepEqual(result,{status:'NOT_RUN',reason:'NVIDIA_DRIVER_MISSING',driver:platform==='linux'?'libcuda.so.1':'nvcuda.dll'});}
 return result;
}
