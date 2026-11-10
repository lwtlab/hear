import assert from 'node:assert/strict';
import test from 'node:test';
import { waveSignal } from './owned-wave-signal.mjs';
function wave(value = 0) {
  const data = Buffer.alloc(44100 * 4), header = Buffer.alloc(44);
  for (let i = 0; i < data.length; i += 2) data.writeInt16LE(value, i);
  header.write('RIFF'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(44100, 24); header.writeUInt32LE(176400, 28);
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
test('reference WAV reader distinguishes silence from independently measured PCM', () => {
  assert.equal(waveSignal(wave()).validSignal, false);
  const signal = waveSignal(wave(4096)); assert.equal(signal.validSignal, true); assert.equal(signal.peak, 0.125);
  const truncated = wave().subarray(0, 100); assert.throws(() => waveSignal(truncated));
  const wrongFormat = wave(); wrongFormat.writeUInt16LE(3, 20); assert.throws(() => waveSignal(wrongFormat));
});
