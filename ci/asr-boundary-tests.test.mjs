import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boundaryCommands } from './asr-boundary-tests.mjs';

test('ASR gate rejects missing test bodies instead of accepting zero matching tests', () => {
  const root = mkdtempSync(join(tmpdir(), 'hear-boundaries-'));
  const folder = join(root, 'crates/asr-command/src');
  mkdirSync(folder, { recursive: true });
  try {
    writeFileSync(join(folder, 'stdio_whisper.rs'), 'fn segments_mode_start_excludes_only_digital_silence_prefix() {}');
    writeFileSync(join(folder, 'vad_whisper.rs'), '');
    assert.throws(() => boundaryCommands(root), /Required ASR boundary regression missing/);
    writeFileSync(join(folder, 'stdio_whisper.rs'), ['segments_mode_start_excludes_only_digital_silence_prefix', 'segments_mode_keeps_arbitrarily_quiet_prefix_audio'].map(n => '#[test]\nfn ' + n + '() {}').join('\n'));
    writeFileSync(join(folder, 'vad_whisper.rs'), '#[test]\nfn detected_speech_preserves_weak_prefix_and_does_not_replay_prior_speech() {}');
    assert.equal(boundaryCommands(root).length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
