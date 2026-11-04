import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyFileOutcomes } from './file-outcomes.mjs';
test('cannot claim Chinese/VAD coverage using only an English success', () => {
  const root = mkdtempSync(join(tmpdir(), 'hear-file-outcomes-'));
  try {
    writeFileSync(join(root, 'result.json'), JSON.stringify({ status: 'PASS', model: { id: 'tiny.en' } }));
    verifyFileOutcomes(root, 'whisper');
    assert.throws(() => verifyFileOutcomes(root, 'whisper-and-sensevoice'));
    mkdirSync(join(root, 'sensevoice'));
    writeFileSync(join(root, 'sensevoice/result.json'), JSON.stringify({ status: 'FAIL', model: { id: 'sensevoice-small' } }));
    assert.throws(() => verifyFileOutcomes(root, 'whisper-and-sensevoice'));
    writeFileSync(join(root, 'sensevoice/result.json'), JSON.stringify({ status: 'PASS', model: { id: 'sensevoice-small' } }));
    verifyFileOutcomes(root, 'whisper-and-sensevoice');
  } finally { rmSync(root, { recursive: true }); }
});
