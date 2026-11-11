// Optional source-only qualification. Existing native/runtime/release gates remain separate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptLog } from './log-crypto.mjs';

export const SOURCE_TASKS = ['hear-tools', 'hear-types', 'hear-unit'];
export const SOURCE_POLICY = 'reader-hear-source-execution-v1';
export const SOURCE_CONTRACT = 'b0d0b4e45767454633f3f2f5ba29c7df4344a398863ac319226781b775315278';
export const SOURCE_GRAPH = '9f3d77a129fca4ad1c4177b5e50fa5b3e4d2f10eca9b6218487dda4ebe3a752a';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const duration = value => Number.isSafeInteger(value) && value >= 0 && value <= 3600000;
function checkedBinding(binding) {
  for (const key of ['sourceRef', 'workflowRef']) assert.match(binding[key] ?? '', /^[a-f0-9]{40}$/);
  for (const key of ['runId', 'runAttempt']) assert(Number.isSafeInteger(binding[key]) && binding[key] > 0);
  assert(['linux-x64', 'darwin-arm64'].includes(binding.platform));
  return { sourceRef: binding.sourceRef, workflowRef: binding.workflowRef, runId: binding.runId, runAttempt: binding.runAttempt, platform: binding.platform };
}
export function sourceResult(bytes, identity, execution, startedAt, now = Date.now()) {
  const binding = checkedBinding(identity);
  const result = {
    schemaVersion: 1, kind: 'hear-catalog-source-verification', diagnostic: true, releaseAcceptance: false,
    ...binding, appPath: 'apps/hear', policy: SOURCE_POLICY, scope: 'hear-source', profile: 'full', selectionApplied: false,
    contractSha256: SOURCE_CONTRACT, summarySha256: null, status: 'FAIL', validation: 'FAIL',
    executionOutcome: ['success', 'failure', 'cancelled', 'skipped'].includes(execution) ? execution : 'unknown',
    tasks: SOURCE_TASKS.map(id => ({ id, status: 'NOT_RUN', durationMs: null })),
    preparationDurationMs: null, sourceDurationMs: null,
    acceptance: { nativeCompilation: 'NOT_RUN', scriptedGui: 'NOT_RUN', modelInference: 'NOT_RUN', signedInstallation: 'NOT_RUN', physicalAudio: 'NOT_RUN' },
  };
  try {
    assert(Buffer.isBuffer(bytes) && bytes.length <= 2 * 1024 * 1024);
    const report = JSON.parse(bytes);
    assert.equal(report.schemaVersion, 1); assert.equal(report.kind, 'hear-source-verification');
    assert.equal(report.scope, 'hear-source'); assert.equal(report.profile, 'full');
    assert.match(report.runId ?? '', /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
    assert.equal(report.environmentPolicy, 'hear-source-defaults-v1');
    assert.equal(`${report.host.platform}-${report.host.arch}`, binding.platform); assert.equal(report.host.node, 'v24.22.0');
    assert.equal(report.source.head, binding.sourceRef); assert.equal(report.source.dirty, false);
    assert.deepEqual(report.source, report.sourceAfter); assert(hex(report.source.inputHash));
    assert(hex(report.inputs.sha256)); assert.equal(report.inputs.sha256, report.inputsAfter.sha256);
    assert.equal(report.inputs.taskGraphSha256, SOURCE_GRAPH); assert.equal(report.inputsAfter.taskGraphSha256, SOURCE_GRAPH);
    assert.deepEqual(report.tasks.map(task => task.id), SOURCE_TASKS);
    const coverage = report.catalogExecution;
    assert.equal(coverage.policy, SOURCE_POLICY); assert.equal(coverage.scope, 'hear-source'); assert.equal(coverage.profile, 'full');
    assert.equal(coverage.selectionApplied, false); assert.equal(coverage.contractSha256, SOURCE_CONTRACT);
    assert.deepEqual(coverage.tasks, report.tasks.map(({ id, status }) => ({ id, status })));
    const begin = Date.parse(report.startedAt), end = Date.parse(report.endedAt);
    assert(Number.isSafeInteger(startedAt) && begin >= startedAt - 1000 && end >= begin && end <= now + 1000);
    assert(duration(report.durationMs) && report.durationMs === end - begin);
    for (const [index, task] of report.tasks.entries()) {
      assert(['PASS', 'FAIL', 'NOT_RUN'].includes(task.status)); assert(duration(task.durationMs));
      if (task.status === 'PASS') { assert.equal(task.exitCode, 0); assert(report.tasks.slice(0, index).every(prerequisite => prerequisite.status === 'PASS')); }
      if (task.status === 'FAIL') assert(task.exitCode !== 0);
    }
    result.validation = 'PASS'; result.summarySha256 = digest(bytes);
    result.tasks = report.tasks.map(({ id, status, durationMs }) => ({ id, status, durationMs }));
    result.preparationDurationMs = Math.max(0, begin - startedAt); result.sourceDurationMs = report.durationMs;
    if (execution === 'success' && report.status === 'PASS' && coverage.status === 'PASS' && report.tasks.every(task => task.status === 'PASS') && !report.failure && !report.cleanupFailure && !report.sourceFailure && !report.executionFailure) result.status = 'PASS';
  } catch { /* Invalid/unbound reports cannot supply successful task evidence. */ }
  return result;
}
function readOrdinary(file, maximum) {
  const info = lstatSync(file); assert(info.isFile() && !info.isSymbolicLink() && info.size <= maximum);
  return readFileSync(file);
}
function readSourceReport() {
  const core = realpathSync('core'), base = realpathSync('core/.artifacts/hear-verify');
  assert(base.startsWith(core + sep)); assert(!lstatSync('core/.artifacts/hear-verify').isSymbolicLink());
  const entries = readdirSync(base), folders = entries.filter(name => name !== 'running.lock'); assert.equal(folders.length, 1, 'Expected one source run');
  assert.match(folders[0], /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const folder = join(base, folders[0]); assert(lstatSync(folder).isDirectory() && !lstatSync(folder).isSymbolicLink());
  return { bytes: readOrdinary(join(folder, 'summary.json'), 2 * 1024 * 1024), locked: entries.includes('running.lock') };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const binding = checkedBinding({ sourceRef: process.env.SOURCE_REF, workflowRef: process.env.GITHUB_SHA, runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), platform: `${process.platform}-${process.arch}` });
    const startFile = 'source-catalog-start.json', resultFile = 'source-catalog-receipt/verification.json';
    const mode = process.argv[2]; assert(process.argv.length === 3 && ['--start', '--collect', '--require-pass'].includes(mode));
    if (mode === '--start') {
      for (const key of ['SOURCE_NATIVE_CHECK', 'SOURCE_FUNCTIONAL_RUNTIME', 'SOURCE_REUSE_NATIVE', 'SOURCE_REUSE_RUNTIME', 'SOURCE_WINDOWS_SIGNAL']) assert.equal(process.env[key], 'false');
      assert(!process.env.SOURCE_APP_REF && !process.env.SOURCE_CORE_REF);
      assert(!existsSync(startFile) && !existsSync('source-catalog-receipt'));
      encryptLog(Buffer.from('source-catalog'), process.env.HEAR_LOG_PUBLIC_KEY);
      writeFileSync(startFile, JSON.stringify({ binding, startedAt: Date.now() }), { mode: 0o600 });
      console.log('Source-only scope validated; native, GUI, models, installation and audio remain NOT_RUN');
    } else {
      const started = JSON.parse(readOrdinary(startFile, 65536)); assert.deepEqual(started.binding, binding);
      let bytes, locked = false; try { ({ bytes, locked } = readSourceReport()); } catch { bytes = null; }
      const result = sourceResult(bytes, binding, locked ? 'failure' : process.env.SOURCE_EXECUTION_OUTCOME, started.startedAt);
      if (mode === '--collect') {
        assert(!existsSync('source-catalog-receipt')); mkdirSync('source-catalog-receipt'); mkdirSync('diagnostics', { recursive: true });
        if (bytes) writeFileSync('diagnostics/source-execution.enc.json', JSON.stringify(encryptLog(bytes, process.env.HEAR_LOG_PUBLIC_KEY)), { mode: 0o600 });
        writeFileSync(resultFile, JSON.stringify(result, null, 2), { mode: 0o600 });
        console.log(`Catalog source result: ${result.status}`);
      } else {
        assert.deepEqual(JSON.parse(readOrdinary(resultFile, 65536)), result); assert.equal(result.status, 'PASS');
      }
    }
  } catch { console.error('Catalog source verification failed; consult encrypted diagnostics'); process.exitCode = 1; }
}
