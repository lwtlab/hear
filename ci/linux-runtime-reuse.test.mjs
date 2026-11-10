import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLinuxReuse } from './linux-runtime-reuse.mjs';
const entry = JSON.parse(readFileSync(new URL('../manifests/linux-runtime-probes.json', import.meta.url)))['linux-x64'];
test('Linux installer replay cannot silently change core, platform or lose origin checksums', () => {
  assert.equal(validateLinuxReuse(entry, 'linux-x64', entry.coreRef), entry);
  assert.throws(() => validateLinuxReuse(entry, 'win32-x64', entry.coreRef));
  assert.throws(() => validateLinuxReuse(entry, 'linux-x64', '0'.repeat(40)));
  for (const bad of [{ ...entry, archiveSha256: '' }, { ...entry, archive: '../runtime.tar.gz' }, { ...entry, bytes: 0 }, { ...entry, appRef: 'main' }]) {
    assert.throws(() => validateLinuxReuse(bad, 'linux-x64', entry.coreRef));
  }
});
