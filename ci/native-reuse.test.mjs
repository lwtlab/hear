import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateNativeReuse } from './native-reuse.mjs';
const entry = JSON.parse(readFileSync(new URL('../manifests/native-probes.json', import.meta.url)))["win32-x64"];

test('accepts only the reviewed exact-source binding', () => {
  assert.equal(validateNativeReuse(entry, 'win32-x64', entry.coreRef), entry);
  assert.throws(() => validateNativeReuse(entry, 'linux-x64', entry.coreRef));
  assert.throws(() => validateNativeReuse(entry, 'win32-x64', '0'.repeat(40)));
  assert.throws(() => validateNativeReuse({ ...entry, archiveSha256: '' }, 'win32-x64', entry.coreRef));
});
