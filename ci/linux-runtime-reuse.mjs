// Installer-only replay of a reviewed diagnostic runtime. This is NOT a new app build.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, openSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function validateLinuxReuse(entry, platform, coreRef) {
  if (!entry || platform !== 'linux-x64' || entry.coreRef !== coreRef ||
      ![entry.appRef, entry.coreRef, entry.workflowRef].every(s => /^[a-f0-9]{40}$/.test(s ?? '')) ||
      ![entry.archiveSha256, entry.sha256].every(s => /^[a-f0-9]{64}$/.test(s ?? '')) ||
      ![entry.artifactId, entry.runId].every(s => /^[0-9]+$/.test(s ?? '')) ||
      entry.archive !== 'AIHearProbe-linux-x64.tar.gz' || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1) {
    throw new Error('No reviewed Linux runtime for this exact core/platform; build fresh');
  }
  return entry;
}
async function main() {
  const entry = validateLinuxReuse(JSON.parse(readFileSync(new URL('../manifests/linux-runtime-probes.json', import.meta.url)))['linux-x64'], `${process.platform}-${process.arch}`, process.env.CORE_REF);
  const work = mkdtempSync(join(tmpdir(), 'hear-linux-replay-'));
  const zip = join(work, 'runtime.zip');
  const fd = openSync(zip, 'wx');
  try { execFileSync('gh', ['api', `repos/lwtlab/hear/actions/artifacts/${entry.artifactId}/zip`], { stdio: ['ignore', fd, 'pipe'] }); }
  finally { closeSync(fd); }
  if (createHash('sha256').update(readFileSync(zip)).digest('hex') !== entry.archiveSha256) throw new Error('Linux artifact ZIP digest mismatch');
  writeFileSync(join(work, 'expected.json'), JSON.stringify(entry));
  execFileSync('python3', ['-c', `
import pathlib,json,zipfile,tarfile,hashlib,shutil,sys
work=pathlib.Path(sys.argv[1]); dest=pathlib.Path(sys.argv[2]); expected=json.loads((work/'expected.json').read_text())
with zipfile.ZipFile(work/'runtime.zip') as z:
 for name in z.namelist():
  if pathlib.Path(name).is_absolute() or '..' in pathlib.Path(name).parts: raise ValueError('Unsafe ZIP member')
 z.extractall(work/'archive')
probe=json.loads((work/'archive/probe.json').read_text())
for key in ('appRef','coreRef','workflowRef','runId','archive','sha256','bytes'):
 if probe.get(key)!=expected[key]: raise ValueError('Linux origin mismatch: '+key)
if probe.get('platform')!='linux-x64' or probe.get('diagnostic') is not True: raise ValueError('Wrong runtime identity')
archive=work/'archive'/expected['archive']
if archive.stat().st_size!=expected['bytes'] or hashlib.sha256(archive.read_bytes()).hexdigest()!=expected['sha256']: raise ValueError('Linux tar digest mismatch')
with tarfile.open(archive) as tar: tar.extractall(work/'extracted',filter='data')
shutil.copytree(work/'extracted/linux-unpacked',dest/'linux-unpacked')
(dest/'runtime-origin.json').write_text(json.dumps(expected,indent=2))
`, work, resolve('apps/desktop/probe-release')], { stdio: 'inherit' });
  console.log('Reviewed Linux runtime restored for installer-only replay; original binary source retained');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
