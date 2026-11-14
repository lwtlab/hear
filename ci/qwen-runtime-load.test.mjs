import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,realpathSync,chmodSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectRuntimeLoad,loaderEnvironment,missingLinuxLibraries,validateRuntimeLoad} from './qwen-runtime-load.mjs';
test('loader inspection names only missing external NVIDIA driver as NOT_RUN',()=>{
 const calls=[],run=(command,args,options)=>{calls.push({command,args,env:options.env});return{status:0,stdout:' libcuda.so.1 => not found\n libc.so.6 => /lib/libc.so.6\n',stderr:''};};
 const env={PATH:'/usr/bin',LD_LIBRARY_PATH:'/fake',LD_PRELOAD:'/inject',LD_AUDIT:'/audit',DYLD_LIBRARY_PATH:'/fake',CUDA_VISIBLE_DEVICES:'0'};
 assert.deepEqual(inspectRuntimeLoad({exe:'/runtime/cli',platform:'linux',env,run}),{status:'NOT_RUN',reason:'NVIDIA_DRIVER_MISSING',driver:'libcuda.so.1'});assert.equal(calls.length,1);assert.deepEqual(calls[0].env,{PATH:'/usr/bin',CUDA_VISIBLE_DEVICES:'0'});assert.equal(env.LD_PRELOAD,'/inject');
 for(const output of ['libcuda.so.1 => not found\nlibggml.so => not found','libcuda.so.1: not found'])assert.throws(()=>inspectRuntimeLoad({exe:'/runtime/cli',platform:'linux',run:()=>({status:0,stdout:output,stderr:''})}));
 assert.deepEqual(missingLinuxLibraries('libcuda.so.1 => not found\nlibcuda.so.1 => not found'),['libcuda.so.1']);assert.deepEqual(loaderEnvironment({LD_DEBUG:'x',RUST_LOG:'debug'}),{RUST_LOG:'debug'});
});
test('available libraries require successful actual CLI exit; timeouts and loader inspection failures fail',()=>{
 for(const failure of [{status:7},{status:0,signal:'SIGKILL'},{status:null,error:Error('timeout')}])assert.throws(()=>inspectRuntimeLoad({exe:'/runtime/cli',platform:'linux',run:command=>command==='/usr/bin/ldd'?{status:0,stdout:'all libraries found',stderr:''}:failure}));
 assert.throws(()=>inspectRuntimeLoad({exe:'/runtime/cli',platform:'linux',run:()=>({status:1,stdout:'',stderr:''})}));
 const calls=[];const result=inspectRuntimeLoad({exe:'/runtime/cli',platform:'linux',run:(command,args)=>{calls.push([command,args]);return{status:0,stdout:'',stderr:''};}});assert.equal(result.status,'PASS');assert.equal(result.gpuExecution,'NOT_RUN');assert.equal(calls.length,2);assert.deepEqual(calls[1],['/runtime/cli',['--help']]);
});
test('Windows driver absence is explicit while other attempted loader failures stay fatal',t=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'qwen-driver-control-')));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'System32'));
 let calls=0;const run=()=>{calls++;return {status:3221225781,stdout:'',stderr:''};};
 assert.equal(inspectRuntimeLoad({exe:join(root,'cli.exe'),platform:'win32',systemRoot:root,run}).status,'NOT_RUN');assert.equal(calls,0);
 writeFileSync(join(root,'System32/nvcuda.dll'),'synthetic presence control');assert.throws(()=>inspectRuntimeLoad({exe:join(root,'cli.exe'),platform:'win32',systemRoot:root,run}));assert.equal(calls,1);
 assert.throws(()=>validateRuntimeLoad({status:'NOT_RUN',reason:'MISSING_DEPENDENCY',driver:'other.dll'},'win32'));assert.throws(()=>validateRuntimeLoad({status:'NOT_RUN',reason:'NVIDIA_DRIVER_MISSING',driver:'libcuda.so.1'},'darwin'));
});

test('actual CLI ignoring SIGTERM is killed within the probe deadline', {skip:process.platform==='win32'},t=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'qwen-loader-deadline-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const ready=join(root,'ready'),exe=join(root,'ignore-term');
 writeFileSync(exe,`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(ready)},'ready');process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(0),4000);\n`);chmodSync(exe,0o700);
 const started=Date.now();assert.throws(()=>inspectRuntimeLoad({exe,platform:'darwin',run:(command,args,options)=>spawnSync(command,args,{...options,timeout:500})}));
 assert(existsSync(ready),'real child entered its SIGTERM handler');assert(Date.now()-started<2500,'SIGTERM-resistant child must not defeat timeout');
});
