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
test('monorepo dispatch binds app and core to one source and rejects mixed identities', () => {
  const sourceRef = 'c'.repeat(40);
  assert.deepEqual(validateDispatch({ sourceRef, mode: 'checks' }), {
    layout: 'monorepo', sourceRef, appRef: sourceRef, coreRef: sourceRef, appPath: 'core/apps/hear',
  });
  for (const invalid of [{ sourceRef: 'main' }, { appRef: 'a'.repeat(40) }, { coreRef: 'b'.repeat(40) }])
    assert.throws(() => validateDispatch({ sourceRef, mode: 'checks', ...invalid }));
});
test('workflow dispatch exposes monorepo input and initializes the legacy checkout conditionally', async () => {
  const { readFileSync } = await import('node:fs');
  for (const name of ['desktop-candidates.yml', 'cross-platform-probe.yml']) {
    const workflow = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.match(workflow, /source_ref:[\s\S]*?required: false/);
    assert.match(workflow, /app_ref:[\s\S]*?required: false/);
    assert.match(workflow, /core_ref:[\s\S]*?required: false/);
    assert.match(workflow, /if: env.SOURCE_LAYOUT == 'legacy-pair'\n\s+with:\n\s+repository: XUJiahua\/lwt-app-hear2/);
    assert.match(workflow, /run: node ci\/assert-sources.mjs/);
    assert.ok(!/hashFiles\('app\//.test(workflow));
  }
});
