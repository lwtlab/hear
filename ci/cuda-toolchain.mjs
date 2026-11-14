// Only vendor archives are cached. No private source/build tree enters this cache.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,lstatSync,realpathSync,copyFileSync,appendFileSync,createWriteStream,chmodSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {join,resolve,dirname,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function cmakeToolPath(value){assert.equal(typeof value,'string');assert(!/[\r\n]/.test(value));return value.replaceAll('\\','/');}
export async function prepareCudaToolchain({root,cache,platform=process.platform,lockFile=join(here,'cuda-toolchain.lock.json')}){
 assert(!existsSync(root),'Fresh SDK root required');const lock=JSON.parse(readFileSync(lockFile));assert(lock.packages[platform]);mkdirSync(root,{recursive:true});mkdirSync(cache,{recursive:true});const packages=[];
 for(const item of lock.packages[platform]){
  assert(/^[a-z_]+$/.test(item.id)&&/^[a-f0-9]{64}$/.test(item.sha256));const archive=join(cache,item.id+'-'+item.sha256+'.archive');
  if(!existsSync(archive)){const response=await fetch(item.url);assert(response.ok);const part=archive+'.part';assert(!existsSync(part));await pipeline(response.body,createWriteStream(part,{flags:'wx'}));assert.equal(hash(part),item.sha256);const {renameSync}=await import('node:fs');renameSync(part,archive);}
  assert.equal(hash(archive),item.sha256);if(item.bytes)assert.equal(lstatSync(archive).size,item.bytes);
  const target=join(root,item.id);execFileSync(process.env.READER_PYTHON??'python',[join(here,'extract-runtime-archive.py'),archive,target,item.prefix,'sdk'],{stdio:'pipe',timeout:180000});packages.push({id:item.id,sha256:item.sha256,bytes:lstatSync(archive).size});
 }
 const sdk=join(root,'cuda');mkdirSync(sdk);const moveTree=(base,at,pkg)=>{for(const name of readdirSync(at)){const f=join(at,name),stat=lstatSync(f);if(stat.isDirectory()){moveTree(base,f,pkg);continue;}const real=realpathSync(f),rel=relative(realpathSync(base),real);assert(!isAbsolute(rel)&&!rel.split(/[\\/]/).includes('..'));assert(lstatSync(real).isFile());const path=relative(base,f),top=path.split(/[\\/]/)[0],to=join(sdk,['bin','include','lib','nvvm','extras'].includes(top)?path:join('component-metadata',pkg,path));mkdirSync(dirname(to),{recursive:true});if(existsSync(to))assert.equal(hash(to),hash(real),'Conflicting CUDA SDK files');else copyFileSync(real,to);}};
 for(const item of lock.packages[platform].filter(p=>p.role==='cuda'))moveTree(join(root,item.id),join(root,item.id),item.id);
 const runtimeFiles={};if(platform!=='darwin'){
  const names=platform==='win32'?['cudart64_12.dll','cublas64_12.dll','cublasLt64_12.dll']:['libcudart.so.12','libcublas.so.12','libcublasLt.so.12'];
  for(const name of names){const path=join(platform==='win32'?'bin':'lib',name);runtimeFiles[name]={path,sha256:hash(join(sdk,path))};}
  const path=join('component-metadata','libcublas','LICENSE');runtimeFiles['LICENSE.NVIDIA.CUDA.txt']={path,sha256:hash(join(sdk,path))};
 }
 if(platform==='darwin'){try{execFileSync('/usr/bin/xcrun',['--find','metal'],{stdio:'pipe'});}catch{execFileSync('/usr/bin/xcodebuild',['-downloadComponent','MetalToolchain'],{stdio:'pipe',timeout:900000,maxBuffer:16*1024**2});}}
 const receipt={status:'PASS',lockSha256:hash(lockFile),cudaVersion:lock.cudaVersion,packages,runtimeFiles};writeFileSync(join(sdk,'toolchain.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 const cmakeDir=join(root,'cmake',...(platform==='darwin'?['CMake.app','Contents','bin']:['bin'])),ninjaDir=join(root,'ninja');
 for(const p of [join(cmakeDir,'cmake'+(platform==='win32'?'.exe':'')),join(ninjaDir,'ninja'+(platform==='win32'?'.exe':''))]){assert(existsSync(p));chmodSync(p,0o755);}
 if(process.env.GITHUB_PATH)appendFileSync(process.env.GITHUB_PATH,[cmakeDir,ninjaDir,...(platform==='darwin'?[]:[join(sdk,'bin')])].join('\n')+'\n');
 if(process.env.GITHUB_ENV){
  const find=name=>execFileSync('/usr/bin/which',[name],{cwd:process.env.RUNNER_TEMP,encoding:'utf8'}).trim();
  const rawCxx=platform==='win32'?join(process.env.VCToolsInstallDir,'bin/Hostx64/x64/cl.exe'):platform==='darwin'?execFileSync('/usr/bin/xcrun',['--find','clang++'],{encoding:'utf8'}).trim():find('g++');
  const rawCc=platform==='win32'?rawCxx:platform==='darwin'?execFileSync('/usr/bin/xcrun',['--find','clang'],{encoding:'utf8'}).trim():find('gcc');
  const cxx=cmakeToolPath(rawCxx),cc=cmakeToolPath(rawCc);
  appendFileSync(process.env.GITHUB_ENV,`CMAKE_GENERATOR=Ninja\nCUDAToolkit_ROOT=${cmakeToolPath(sdk)}\nCUDA_PATH=${cmakeToolPath(sdk)}\nREADER_CMAKE=${cmakeToolPath(join(cmakeDir,'cmake'+(platform==='win32'?'.exe':'')))}\nREADER_NINJA=${cmakeToolPath(join(ninjaDir,'ninja'+(platform==='win32'?'.exe':'')))}\nREADER_CXX=${cxx}\nREADER_CC=${cc}\n${platform==='darwin'?'':`READER_CUDA_COMPILER=${cmakeToolPath(join(sdk,'bin','nvcc'+(platform==='win32'?'.exe':'')))}\n`}`);
 }
 return {sdk,receipt};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){await prepareCudaToolchain({root:resolve(process.env.RUNNER_TEMP,'qwen-sdk'),cache:resolve(process.env.RUNNER_TEMP,'qwen-sdk-downloads')});console.log('Locked public toolchain prepared');}
