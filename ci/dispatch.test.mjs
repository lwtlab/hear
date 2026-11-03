import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDispatch } from './dispatch.mjs';
test('dispatch accepts immutable source pairs and rejects refs and unsupported modes', () => {
  const valid = { appRef: 'a'.repeat(40), coreRef: 'b'.repeat(40), mode: 'checks' };
  validateDispatch(valid); validateDispatch({ ...valid, mode: 'candidate' });
  for (const invalid of [{ appRef: 'main' }, { coreRef: 'HEAD' }, { mode: 'linux-x64' }, { appRef: 'a'.repeat(40) + '\n' }]) {
    assert.throws(() => validateDispatch({ ...valid, ...invalid }));
  }
});
