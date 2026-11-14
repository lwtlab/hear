import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

test('actual Unix candidate integration commands isolate build mode without masking test overrides', {skip:process.platform==='win32'}, t=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'hear-candidate-env-')));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 symlinkSync(fileURLToPath(new URL('.',import.meta.url)),join(root,'ci'),'dir');
 mkdirSync(join(root,'core/scripts'),{recursive:true});
 writeFileSync(join(root,'core/scripts/hear.sh'),`#!/bin/bash
set -eu
test "$1" = check
test -z "\${HEAR_QWEN_RUNTIME_MODE:-}" || exit 31
test "$HEAR_CORE_DIR" = "$PWD"
# Represents the existing source-check refusal; unrelated opt-ins must survive.
test -z "\${HEAR_REAL_DL:-}" || exit 23
`);
 const workflow=readFileSync(new URL('../.github/workflows/desktop-candidates.yml',import.meta.url),'utf8');
 const commands=workflow.split('\n').filter(line=>line.includes('node ci/private-step.mjs integration core bash scripts/hear.sh check')).map(line=>line.trim().replace(/^run:\s*/,''));
 assert.equal(commands.length,2,'both macOS and Linux call sites are covered');
 const env={...process.env,SOURCE_LAYOUT:'monorepo',RUNNER_TEMP:root,HEAR_CORE_DIR:join(root,'core'),HEAR_QWEN_RUNTIME_MODE:'verified-ci'};
 delete env.HEAR_REAL_DL;
 for(const command of commands){
  const clean=spawnSync('bash',['-c',command],{cwd:root,env,encoding:'utf8'});
  assert.equal(clean.status,0,clean.stderr);
  const configured=spawnSync('bash',['-c',command],{cwd:root,env:{...env,HEAR_REAL_DL:'synthetic-opt-in'},encoding:'utf8'});
  assert.equal(configured.status,1,'source-check failure must propagate');
 }
 const native=spawnSync(process.execPath,[join(root,'ci/private-step.mjs'),'native','core',process.execPath,'-e',`require('node:assert/strict').equal(process.env.HEAR_QWEN_RUNTIME_MODE,'verified-ci')`],{cwd:root,env,encoding:'utf8'});
 assert.equal(native.status,0,native.stderr);
 assert.equal(env.HEAR_QWEN_RUNTIME_MODE,'verified-ci');
});
