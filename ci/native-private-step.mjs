// Dedicated native progress wrapper: builtin-only, bounded output, no catalog side effects.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const phases=['plan','reuse','sdk','source','build','collect','consume'];
const [phase,command,...args]=process.argv.slice(2);assert(phases.includes(phase)&&command,'Known native task and command required');const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),log=join(process.env.RUNNER_TEMP,'hear-private.log'),started=Date.now();appendFileSync(log,`\n--- qwen-${phase} ---\n`,{mode:0o600});
const findTool=name=>execFileSync(process.platform==='win32'?join(process.env.SystemRoot,'System32/where.exe'):'/usr/bin/which',[name],{cwd:process.env.RUNNER_TEMP,encoding:'utf8'}).split(/\r?\n/)[0].trim().replaceAll('\\','/');
const env={...process.env,READER_GIT:findTool('git'),READER_GH:findTool('gh'),READER_PYTHON:findTool('python')};const executable=command==='node'?process.execPath:command==='git'?env.READER_GIT:command;assert(executable===process.execPath||executable===env.READER_GIT,'Only pinned Node and system Git commands are permitted');
const child=spawn(executable,args,{cwd:join(root,'core'),env,stdio:['ignore','pipe','pipe']});let bytes=0,limited=false;for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{bytes+=b.length;if(bytes>128*1024**2){limited=true;child.kill();return;}appendFileSync(log,b);});child.on('error',e=>appendFileSync(log,e.stack+'\n'));const exit=await new Promise(r=>child.once('close',r));const passed=exit===0&&!limited;console.log(JSON.stringify({taskId:'qwen-'+phase,status:passed?'PASS':'FAIL',durationMs:Date.now()-started}));if(!passed)process.exit(1);
