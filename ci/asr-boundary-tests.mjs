import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function boundaryCommands(root) {
  const specs = [
    ['stdio_whisper', ['segments_mode_start_excludes_only_digital_silence_prefix', 'segments_mode_keeps_arbitrarily_quiet_prefix_audio'], 'stdio_whisper::tests::'],
    ['vad_whisper', ['detected_speech_preserves_weak_prefix_and_does_not_replay_prior_speech'], 'vad_whisper::boundary_tests::'],
  ];
  for (const [file, names] of specs) {
    const source = readFileSync(join(root, 'crates/asr-command/src', file + '.rs'), 'utf8');
    for (const name of names) assert.match(source, new RegExp('#\\[test\\]\\s+fn\\s+' + name + '\\s*\\('), 'Required ASR boundary regression missing: ' + name);
  }
  return specs.map(([, , filter]) => ['test', '-p', 'asr-command', '--lib', '--locked', filter]);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const root = resolve(process.argv[2] ?? 'core');
  for (const args of boundaryCommands(root)) {
    const result = spawnSync('cargo', args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'ASR boundary regressions failed');
  }
}
