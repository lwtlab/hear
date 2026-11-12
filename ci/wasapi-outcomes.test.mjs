import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { decryptLog } from './log-crypto.mjs';
import test from 'node:test';
import { wasapiOutcome } from './wasapi-outcomes.mjs';
const sourceRef = 'a'.repeat(40);
function fixture(value = 0.1) {
  const pcm = Buffer.alloc(48000 * 4); for (let i=0;i<pcm.length;i+=4) pcm.writeFloatLE(value,i);
  const raw = { diagnostic: true, releaseAcceptance: false, captureScope: 'owned-approved-sample-player-only', status: 'PASS', sampleSha256: '1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67', savedAudioSha256: createHash('sha256').update(pcm).digest('hex'), native: { schemaVersion: 1, kind: 'hear-native-build', coreRef: sourceRef, clean: true, platform:'win32', arch:'x64', napi:process.versions.napi, filename:'hear-core.win32-x64-msvc.node', sha256:'b'.repeat(64) }, cleanup: { capture:'PASS',player:'PASS',scratch:'PASS' }, error:'PRIVATE-DIAGNOSTIC' };
  return { raw, pcm, identity: { sourceRef, outcome:'success' } };
}
test('independently validates signal and retains only bounded identity and metric fields', () => {
  const f=fixture(), r=wasapiOutcome(f.raw,f.pcm,f.identity);
  assert.equal(r.status,'PASS'); assert.equal(r.releaseAcceptance,false); assert.equal(r.pcm.validSignal,true);
  assert.equal(r.sourceRef,sourceRef); assert.equal(r.savedAudioSha256,f.raw.savedAudioSha256);
  assert(!JSON.stringify(r).includes('PRIVATE-DIAGNOSTIC'));
});
test('silent noise, wrong sources, dirty native inputs and cleanup failure never pass', () => {
  const silence=fixture(1/32768); assert.equal(wasapiOutcome(silence.raw,silence.pcm,silence.identity).status,'FAIL');
  const f=fixture();
  for(const change of [{captureScope:'default-output'},{native:{...f.raw.native,clean:false}},{native:{...f.raw.native,coreRef:'c'.repeat(40)}},{sampleSha256:'c'.repeat(64)},{savedAudioSha256:'c'.repeat(64)},{cleanup:{...f.raw.cleanup,player:'FAIL'}}]) assert.equal(wasapiOutcome({...f.raw,...change},f.pcm,f.identity).status,'FAIL');
  assert.equal(wasapiOutcome(f.raw,f.pcm,{...f.identity,outcome:'failure'}).status,'FAIL');
  assert.equal(wasapiOutcome(null,null,{sourceRef,outcome:'skipped'}).status,'NOT_RUN');
});

test('explicit deferral cannot promote existing signal evidence or a run that ignored dispatch', () => {
  const f = fixture();
  const deferred = wasapiOutcome(f.raw, f.pcm, { ...f.identity, outcome: 'skipped', requested: false });
  assert.equal(deferred.status, 'NOT_RUN');
  assert.equal(deferred.reason, 'deferred-by-dispatch');
  assert.equal(deferred.sourceRef, sourceRef);
  assert.equal(deferred.requested, false);
  assert.equal(deferred.pcm, undefined);
  assert.equal(wasapiOutcome(f.raw, f.pcm, { ...f.identity, requested: false }).status, 'FAIL');
});

test('deferred CLI neither reads stale diagnostic bytes nor encrypts them', t => {
  const scratch = mkdtempSync(join(tmpdir(), 'hear-wasapi-deferred-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const directory = join(scratch, 'hear-wasapi-owned'); mkdirSync(directory);
  writeFileSync(join(directory, 'wasapi-result.json'), 'invalid stale private diagnostic');
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./wasapi-outcomes.mjs', import.meta.url))], {
    cwd: scratch, encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: scratch, SOURCE_REF: sourceRef,
      WASAPI_OWNED_REQUESTED: 'false', WASAPI_OWNED_OUTCOME: 'skipped', HEAR_LOG_PUBLIC_KEY: '' },
  });
  assert.equal(run.status, 0, run.stderr);
  const published = JSON.parse(readFileSync(join(scratch, 'wasapi-public-result.json')));
  assert.equal(published.status, 'NOT_RUN');
  assert.equal(published.reason, 'deferred-by-dispatch');
  assert.equal(published.requested, false);
  assert.equal(published.sourceRef, sourceRef);
  assert(!run.stdout.includes('private diagnostic'));
  assert.throws(() => readFileSync(join(scratch, 'diagnostics/owned-wasapi.enc.json')), { code: 'ENOENT' });
});

test('only the owned signal step observes dispatch deferral; native and file gates remain', () => {
  const workflow = readFileSync(new URL('../.github/workflows/cross-platform-probe.yml', import.meta.url), 'utf8');
  assert.match(workflow, /windows_owned_signal:\n\s+description:.*\n\s+required: true\n\s+default: true\n\s+type: boolean/);
  assert.match(workflow, /WASAPI_OWNED_REQUESTED: \$\{\{ github.event_name != 'workflow_dispatch' \|\| inputs.windows_owned_signal \}\}/);
  const steps = workflow.split(/\n      - /);
  const guarded = steps.filter(step => step.includes("env.WASAPI_OWNED_REQUESTED == 'true'"));
  assert.equal(guarded.length, 1);
  assert.match(guarded[0], /^id: wasapi_owned/);
  for (const id of ['native_build', 'file_functional', 'system_audio']) {
    assert(steps.some(step => step.startsWith(`id: ${id}\n`)));
  }
});

test('source-bound pre-PCM failure metadata is encrypted and never published', t => {
  const scratch = mkdtempSync(join(tmpdir(), 'hear-wasapi-outcome-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const { raw } = fixture(); delete raw.savedAudioSha256; raw.status = 'FAIL';
  const directory = join(scratch, 'hear-wasapi-owned'); mkdirSync(directory);
  writeFileSync(join(directory, 'wasapi-result.json'), JSON.stringify(raw));
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./wasapi-outcomes.mjs', import.meta.url))], {
    cwd: scratch, encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: scratch, SOURCE_REF: sourceRef,
      WASAPI_OWNED_OUTCOME: 'failure', HEAR_LOG_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }) },
  });
  assert.equal(run.status, 0, run.stderr);
  const published = readFileSync(join(scratch, 'wasapi-public-result.json'), 'utf8');
  assert.equal(JSON.parse(published).status, 'FAIL');
  assert(!published.includes(raw.error)); assert(!run.stdout.includes(raw.error));
  const retained = JSON.parse(decryptLog(JSON.parse(readFileSync(join(scratch, 'diagnostics/owned-wasapi.enc.json'))), privateKey));
  assert.equal(retained.metadata.error, raw.error); assert.equal(retained.pcmF32le, undefined);
});
