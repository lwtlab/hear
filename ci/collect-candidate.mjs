import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const release = 'app/apps/desktop/release';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const appRef = git('app', 'rev-parse', 'HEAD');
const coreRef = git('core', 'rev-parse', 'HEAD');
if (appRef !== process.env.APP_REF || coreRef !== process.env.CORE_REF) throw new Error('Checkout identity mismatch');
mkdirSync('candidate', { recursive: true });
const assets = [];
for (const name of readdirSync(release).sort()) {
  if (!/^AIHear-[A-Za-z0-9.+_-]+\.(dmg|zip)$/.test(name)) continue;
  const src = join(release, name); const stat = lstatSync(src);
  if (!stat.isFile()) throw new Error('Asset must be a regular file');
  const sha256 = createHash('sha256').update(readFileSync(src)).digest('hex');
  copyFileSync(src, join('candidate', name));
  assets.push({ name, bytes: stat.size, sha256 });
}
if (!assets.some(a => a.name.endsWith('.dmg')) || !assets.some(a => a.name.endsWith('.zip'))) throw new Error('Missing candidate assets');
writeFileSync('candidate/candidate.json', JSON.stringify({ schemaVersion: 1, product: 'AIHear', platform: 'darwin-arm64', distribution: 'unsigned-ci-candidate', version: JSON.parse(readFileSync('app/apps/desktop/package.json')).version, appRef, coreRef, workflowRef: git('.', 'rev-parse', 'HEAD'), runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, appSubmodules: git('app', 'submodule', 'status', '--recursive').split('\n'), coreSubmodules: git('core', 'submodule', 'status', '--recursive').split('\n'), assets, acceptance: { packagedUI: 'NOT RUN', realAudio: 'NOT RUN', signedDistribution: 'NOT RUN', windows: 'NOT RUN', linux: 'NOT RUN' } }, null, 2) + '\n');
