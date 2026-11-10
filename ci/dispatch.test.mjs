import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDispatch, validateDispatch } from './dispatch.mjs';
test('website and deployment pin the unified pnpm version and explicitly approve native builds', async () => {
  const { readFileSync } = await import('node:fs');
  const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
  const manager = JSON.parse(read('package.json')).packageManager;
  assert.equal(manager, 'pnpm@11.5.2');
  assert.ok(read('.github/workflows/deploy.yml').includes('package-manager: ' + manager));
  for (const dependency of ['sharp', 'esbuild'])
    assert.match(read('pnpm-workspace.yaml'), new RegExp('^  ' + dependency + ': true$', 'm'));
  assert.ok(!read('pnpm-workspace.yaml').includes('dangerouslyAllowAllBuilds'));
});
test('default source is monorepo and explicit historical pairs never borrow defaults', () => {
  const defaultSourceRef = 'd'.repeat(40), mode = 'checks';
  assert.equal(resolveDispatch({ defaultSourceRef, mode }).sourceRef, defaultSourceRef);
  assert.equal(resolveDispatch({ defaultSourceRef, sourceRef: 'e'.repeat(40), mode }).sourceRef, 'e'.repeat(40));
  assert.equal(resolveDispatch({ defaultSourceRef, appRef: 'a'.repeat(40), coreRef: 'b'.repeat(40), mode }).layout, 'legacy-pair');
  for (const invalid of [{ appRef: 'a'.repeat(40) }, { coreRef: 'b'.repeat(40) }, { defaultSourceRef: 'main' }, { sourceRef: 'c'.repeat(40), coreRef: 'b'.repeat(40) }])
    assert.throws(() => resolveDispatch({ defaultSourceRef, mode, ...invalid }));
});
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
    assert.match(workflow, /package_json_file: \$\{\{ env.HEAR_APP_PATH \}\}\/package.json/);
    assert.match(workflow, /defaultSourceRef: process.env.DEFAULT_SOURCE_REF/);
    assert.match(workflow, /DEFAULT_SOURCE_REF: \$\{\{ vars.HEAR_VERIFY_SOURCE_SHA \}\}/);
    assert.ok(!workflow.includes('vars.HEAR_VERIFY_APP_SHA'));
    assert.ok(!workflow.includes('vars.HEAR_VERIFY_CORE_SHA'));
    assert.ok(!workflow.includes("github.event_name == 'push' && vars.HEAR_VERIFY_SOURCE_SHA"));
    assert.ok(!/hashFiles\('app\//.test(workflow));
  }
});
test('monorepo workflows retain root tooling, Linux unit gates and small attempt-bound receipts', async () => {
  const { readFileSync } = await import('node:fs');
  const read = name => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
  for (const name of ['desktop-candidates.yml', 'cross-platform-probe.yml'])
    assert.ok(read(name).includes('core bash scripts/hear.sh check'));
  assert.ok(read('cross-platform-probe.yml').includes('node ci/private-step.mjs unit app pnpm test:unit'));
  assert.ok(read('cross-platform-probe.yml').includes('name: Require monorepo Linux type safety'));
  assert.match(read('cross-platform-probe.yml'), /name: hear-probe-receipt-.*github.run_attempt.*\n\s+path: probe-artifact\/probe.json/);
  assert.match(read('desktop-candidates.yml'), /name: hear-candidate-receipt-.*github.run_attempt.*\n\s+path: candidate\/candidate.json/);
});
