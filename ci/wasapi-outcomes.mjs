// Only owned, approved-sample diagnostic PCM is retained, encrypted. The public
// receipt contains bounded signal metrics and identities, never raw diagnostics.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptLog } from './log-crypto.mjs';
const digest = data => createHash('sha256').update(data).digest('hex');
const sha = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const sample = '1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67';
export function wasapiOutcome(raw, pcm, { sourceRef, outcome, requested = true }) {
  const result = { diagnostic: true, releaseAcceptance: false, captureScope: 'owned-approved-sample-player-only', requested, status: outcome === 'skipped' || !outcome ? 'NOT_RUN' : 'FAIL' };
  if (!requested) return { ...result, reason: result.status === 'NOT_RUN' ? 'deferred-by-dispatch' : 'dispatch-exclusion-violated', ...(/^[a-f0-9]{40}$/.test(sourceRef ?? '') ? { sourceRef } : {}) };
  if (!raw || !/^[a-f0-9]{40}$/.test(sourceRef ?? '') || raw.captureScope !== result.captureScope || raw.diagnostic !== true || raw.releaseAcceptance !== false || raw.sampleSha256 !== sample) return result;
  const n = raw.native;
  if (n?.schemaVersion !== 1 || n.kind !== 'hear-native-build' || n.coreRef !== sourceRef || n.clean !== true || n.platform !== 'win32' || n.arch !== 'x64' || n.napi !== process.versions.napi || n.filename !== 'hear-core.win32-x64-msvc.node' || !sha(n.sha256)) return result;
  Object.assign(result, { sourceRef, nativeSha256: n.sha256, sampleSha256: sample });
  if (!Buffer.isBuffer(pcm) || pcm.length > 2 * 1024 * 1024 || pcm.length % 4 || !sha(raw.savedAudioSha256) || digest(pcm) !== raw.savedAudioSha256) return result;
  const samples = pcm.length / 4; let peak = 0, sum = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const value = pcm.readFloatLE(i); if (!Number.isFinite(value) || Math.abs(value) > 1.001) return result;
    peak = Math.max(peak, Math.abs(value)); sum += value * value;
  }
  const rms = samples ? Math.sqrt(sum / samples) : 0;
  const validSignal = samples >= 48000 && peak >= 0.01 && rms >= 0.001;
  Object.assign(result, { savedAudioSha256: raw.savedAudioSha256, pcm: { samples, sampleRate: 48000, peak, rms, validSignal } });
  const cleanup = raw.cleanup;
  if (outcome === 'success' && raw.status === 'PASS' && validSignal && ['capture','player','scratch'].every(k => cleanup?.[k] === 'PASS')) result.status = 'PASS';
  return result;
}
function boundedFile(file, limit) {
  if (!existsSync(file)) return null;
  const s = lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || s.size > limit) throw Error('Invalid diagnostic artifact');
  return readFileSync(file);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = join(process.env.RUNNER_TEMP, 'hear-wasapi-owned');
  const requested = process.env.WASAPI_OWNED_REQUESTED !== 'false';
  let raw, pcm, result;
  try {
    const data = requested ? boundedFile(join(directory, 'wasapi-result.json'), 65536) : null;
    raw = data ? JSON.parse(data) : null;
    pcm = requested ? boundedFile(join(directory, 'owned-player.f32le'), 2 * 1024 * 1024) : null;
    result = wasapiOutcome(raw, pcm, { sourceRef: process.env.SOURCE_REF, outcome: process.env.WASAPI_OWNED_OUTCOME, requested });
    // Do not retain unbound bytes or report text as public artifacts.
    if (requested && result.sourceRef) {
      mkdirSync('diagnostics', { recursive: true });
      writeFileSync('diagnostics/owned-wasapi.enc.json', JSON.stringify(encryptLog(Buffer.from(JSON.stringify({ metadata: raw, ...(result.savedAudioSha256 ? { pcmF32le: pcm.toString('base64') } : {}) })), process.env.HEAR_LOG_PUBLIC_KEY)));
    }
  } catch { result = { diagnostic: true, releaseAcceptance: false, status: 'FAIL', captureScope: 'owned-approved-sample-player-only' }; }
  writeFileSync(join(process.env.RUNNER_TEMP, 'wasapi-public-result.json'), JSON.stringify(result));
  console.log(`Owned WASAPI signal: ${result.status}; not physical audio or release acceptance`);
}
