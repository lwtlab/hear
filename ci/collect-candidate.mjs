import { sourcePaths } from './dispatch.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readCandidateRuntime, candidateGit } from './qwen-candidate.mjs';
const workspace=resolve(process.argv[2]??process.cwd()), selected=sourcePaths();
const app=join(workspace,selected.app),core=join(workspace,selected.core),candidate=join(workspace,'candidate');
const release = join(app, 'apps/desktop/release');
const git=candidateGit;
const workflowRef=git(workspace,'rev-parse','HEAD');
if(process.env.GITHUB_SHA && process.env.GITHUB_SHA!==workflowRef)throw new Error('Public checkout identity mismatch');
if(git(workspace,'status','--porcelain','--untracked-files=no'))throw new Error('Public source changed during build');
const appRef = git(app, 'rev-parse', 'HEAD');
const coreRef = git(core, 'rev-parse', 'HEAD');
let nativeOrigin; let qwen;
if (process.env.SOURCE_LAYOUT === 'monorepo' && (appRef !== process.env.SOURCE_REF || coreRef !== process.env.SOURCE_REF)) throw new Error('Monorepo source identity mismatch');
if (appRef !== process.env.APP_REF || coreRef !== process.env.CORE_REF) throw new Error('Checkout identity mismatch');
for (const cwd of [app, core]) {
  if (git(cwd, 'status', '--porcelain=v1', '--untracked-files=normal')) throw new Error('Source checkout changed during build');
}
mkdirSync(candidate, { recursive: true });
if (process.env.SOURCE_LAYOUT === 'monorepo') {
  const origin = JSON.parse(readFileSync(join(core, 'hear-core/native-origin.json')));
  const file = join(core, 'hear-core/hear-core.darwin-arm64.node');
  if (origin.kind !== 'hear-native-build' || origin.coreRef !== coreRef || origin.clean !== true ||
      origin.platform !== 'darwin' || origin.arch !== 'arm64' || origin.filename !== 'hear-core.darwin-arm64.node' ||
      !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink() ||
      createHash('sha256').update(readFileSync(file)).digest('hex') !== origin.sha256)
    throw new Error('Native build identity mismatch');
  nativeOrigin = { kind: origin.kind, coreRef, clean: true, platform: origin.platform,
    arch: origin.arch, napi: origin.napi, filename: origin.filename, sha256: origin.sha256 };
  qwen=readCandidateRuntime({core,stage:join(app,'apps/desktop/resources/bin/darwin-arm64/qwen3'),source:coreRef,workflow:git(workspace,'rev-parse','HEAD'),run:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT),proofFile:join(process.env.RUNNER_TEMP??tmpdir(),'hear-qwen-candidate.json'),proofSha256:process.env.HEAR_QWEN_PROOF_SHA256,target:'darwin-arm64-metal'});
}
const assets = [];
for (const name of readdirSync(release).sort()) {
  if (!/^AIHear-[A-Za-z0-9.+_-]+\.(dmg|zip)$/.test(name)) continue;
  const src = join(release, name); const stat = lstatSync(src);
  if (!stat.isFile()) throw new Error('Asset must be a regular file');
  const sha256 = createHash('sha256').update(readFileSync(src)).digest('hex');
  copyFileSync(src, join(candidate, name));
  assets.push({ name, bytes: stat.size, sha256 });
}
if (!assets.some(a => a.name.endsWith('.dmg')) || !assets.some(a => a.name.endsWith('.zip'))) throw new Error('Missing candidate assets');
writeFileSync(join(candidate,'candidate.json'), JSON.stringify({ schemaVersion: process.env.SOURCE_LAYOUT === 'monorepo' ? 2 : 1, ...(process.env.SOURCE_LAYOUT === 'monorepo' ? { source: { repository: 'lwtlab/lwt-core', commit: process.env.SOURCE_REF, appPath: 'apps/hear' } } : {}), product: 'AIHear', platform: 'darwin-arm64', distribution: 'unsigned-ci-candidate', version: JSON.parse(readFileSync(join(app, 'apps/desktop/package.json'))).version, appRef, coreRef, workflowRef: git(workspace, 'rev-parse', 'HEAD'), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, appSubmodules: git(app, 'submodule', 'status', '--recursive').split('\n'), coreSubmodules: git(core, 'submodule', 'status', '--recursive').split('\n'), assets, nativeOrigin, ...(qwen?{qwen}:{}), acceptance: { packagedUI: 'NOT RUN', realAudio: 'NOT RUN', signedDistribution: 'NOT RUN', windows: 'NOT RUN', linux: 'NOT RUN' } }, null, 2) + '\n');
