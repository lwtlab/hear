import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateNativeReuse, validateNativeBytes } from './native-reuse.mjs';
import { createHash } from 'node:crypto';
const entry = JSON.parse(readFileSync(new URL('../manifests/native-probes.json', import.meta.url)))["win32-x64"];
test('modern reviewed native bytes must match the retained native digest', () => {
  const bytes = Buffer.from('owned diagnostic native bytes');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  validateNativeBytes({ sha256 }, bytes);
  assert.throws(() => validateNativeBytes({ sha256 }, Buffer.from('different bytes')));
  assert.throws(() => validateNativeBytes({ sha256: '' }, bytes));
});

test('accepts only the reviewed exact-source binding', () => {
  assert.equal(validateNativeReuse(entry, 'win32-x64', entry.coreRef), entry);
  assert.throws(() => validateNativeReuse(entry, 'linux-x64', entry.coreRef));
  assert.throws(() => validateNativeReuse(entry, 'win32-x64', '0'.repeat(40)));
  assert.throws(() => validateNativeReuse({ ...entry, archiveSha256: '' }, 'win32-x64', entry.coreRef));
});

test('Linux reuse is exact-core and GNU-target only', () => {
  const linux = { ...entry, filename: 'hear-core.linux-x64-gnu.node' };
  assert.equal(validateNativeReuse(linux, 'linux-x64', entry.coreRef), linux);
  assert.throws(() => validateNativeReuse(linux, 'linux-arm64', entry.coreRef));
  assert.throws(() => validateNativeReuse(linux, 'linux-x64', '0'.repeat(40)));
  assert.throws(() => validateNativeReuse({ ...linux, filename: '../binding.node' }, 'linux-x64', entry.coreRef));
});

test('macOS reuse accepts only the reviewed ARM binding', () => {
  const mac = { ...entry, filename: 'hear-core.darwin-arm64.node' };
  assert.equal(validateNativeReuse(mac, 'darwin-arm64', entry.coreRef), mac);
  assert.throws(() => validateNativeReuse(mac, 'darwin-x64', entry.coreRef));
  assert.throws(() => validateNativeReuse(mac, 'darwin-arm64', '0'.repeat(40)));
});
