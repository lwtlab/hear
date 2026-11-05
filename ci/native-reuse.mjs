// Reuse only a maintainer-reviewed, exact-source native runtime; expires with its CI artifact.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function validateNativeReuse(entry, platform, coreRef) {
  const filename = { 'win32-x64': 'hear-core.win32-x64-msvc.node', 'linux-x64': 'hear-core.linux-x64-gnu.node' }[platform];
  if (!entry || !filename || !/^[a-f0-9]{40}$/.test(coreRef ?? '') || entry.coreRef !== coreRef
    || entry.filename !== filename
    || !/^[a-f0-9]{64}$/.test(entry.archiveSha256)
    || !/^[0-9]+$/.test(entry.artifactId) || !/^[0-9]+$/.test(entry.runId)
    || !/^[a-f0-9]{40}$/.test(entry.workflowRef)) throw new Error('No reviewed native runtime for this exact source/platform; build fresh');
  return entry;
}
async function main() {
  const platform = `${process.platform}-${process.arch}`;
  const manifest = JSON.parse(readFileSync(new URL('../manifests/native-probes.json', import.meta.url), 'utf8'));
  const entry = validateNativeReuse(manifest[platform], platform, process.env.CORE_REF);
  const work = mkdtempSync(join(tmpdir(), 'hear-native-reuse-'));
  const archive = join(work, 'native.zip');
  const download = spawnSync('gh', ['api', `repos/lwtlab/hear/actions/artifacts/${entry.artifactId}/zip`], { maxBuffer: 100 * 1024 ** 2 });
  if (download.status !== 0) throw new Error('Pinned native artifact unavailable; build fresh');
  if (createHash('sha256').update(download.stdout).digest('hex') !== entry.archiveSha256) throw new Error('Native artifact digest mismatch');
  writeFileSync(archive, download.stdout);
  // Git Bash's GNU tar cannot read ZIP; use the Windows bsdtar explicitly.
  if (process.platform === 'win32') {
    const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    const unpack = spawnSync(tar, ['-xf', archive, '-C', work]);
    if (unpack.status !== 0) throw new Error('Cannot unpack native artifact');
  } else {
    // Read only the reviewed basename. No ZIP-controlled paths are extracted.
    const unpack = spawnSync('/usr/bin/unzip', ['-p', archive, entry.filename], { maxBuffer: 100 * 1024 ** 2 });
    if (unpack.status !== 0 || !unpack.stdout.length) throw new Error('Cannot read native artifact');
    writeFileSync(join(work, entry.filename), unpack.stdout);
  }
  const core = resolve('hear-core');
  copyFileSync(join(work, entry.filename), join(core, entry.filename));
  writeFileSync(join(core, 'native-origin.json'), JSON.stringify(entry));
  const require = createRequire(join(core, 'package.json'));
  process.chdir(work); // Native logging must not write into the source checkout.
  const native = require(core);
  if (typeof native.AudioRecorder !== 'function' || typeof native.convertSegments !== 'function') throw new Error('Pinned native exports unavailable');
  console.log('Exact-source native artifact verified and loaded');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
