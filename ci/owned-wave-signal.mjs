import assert from 'node:assert/strict';
// Microsoft ApplicationLoopback emits signed 16-bit PCM WAV. No arbitrary codec
// or source files are admitted by this diagnostic reader.
export function waveSignal(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length >= 44 && bytes.length <= 4 * 1024 * 1024);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let format, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8; assert(start + size <= bytes.length);
    if (id === 'fmt ') { assert(!format && size >= 16); format = bytes.subarray(start, start + size); }
    if (id === 'data') { assert(!data); data = bytes.subarray(start, start + size); }
    offset = start + size + (size % 2);
  }
  assert(format && data); assert.equal(format.readUInt16LE(0), 1);
  const channels = format.readUInt16LE(2), sampleRate = format.readUInt32LE(4);
  assert.equal(channels, 2); assert.equal(sampleRate, 44100); assert.equal(format.readUInt16LE(14), 16);
  assert.equal(data.length % 4, 0);
  let peak = 0, sum = 0;
  for (let i = 0; i < data.length; i += 2) { const value = data.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(value)); sum += value * value; }
  const samples = data.length / 2, rms = samples ? Math.sqrt(sum / samples) : 0;
  return { samples, channels, sampleRate, peak, rms, validSignal: samples >= sampleRate * channels && peak >= 0.01 && rms >= 0.001 };
}
