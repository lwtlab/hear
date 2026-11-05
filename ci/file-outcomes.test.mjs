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
test('Linux cannot reuse a non-sandboxed file result or omit the ordinary launch', () => {
  const root = mkdtempSync(join(tmpdir(), 'hear-sandbox-outcomes-'));
  const file = { status: 'PASS', model: { id: 'tiny.en' }, requireSandbox: true, identity: { sandboxDisabled: false } };
  const options = { requireSandbox: true };
  try {
    writeFileSync(join(root, 'result.json'), JSON.stringify({ ...file, requireSandbox: false }));
    assert.throws(() => verifyFileOutcomes(root, 'whisper', options), /Sandbox/);
    writeFileSync(join(root, 'result.json'), JSON.stringify(file));
    assert.throws(() => verifyFileOutcomes(root, 'whisper', options));
    mkdirSync(join(root, 'linux-installed'));
    const ordinary = { status: 'PASS', restrictedUserNamespaces: '1', appArmor: 'aihear-probe (unconfined)', arguments: [], renderers: [{ Seccomp: '2', NoNewPrivs: '1' }] };
    const save = v => writeFileSync(join(root, 'linux-installed/ordinary-launch.json'), JSON.stringify(v));
    for (const bad of [{ ...ordinary, restrictedUserNamespaces: '0' }, { ...ordinary, renderers: [] }, { ...ordinary, arguments: ['--no-sandbox'] }, { ...ordinary, appArmor: 'unconfined' }]) {
      save(bad);
      assert.throws(() => verifyFileOutcomes(root, 'whisper', options), /ordinary/);
    }
    save(ordinary);
    verifyFileOutcomes(root, 'whisper', options);
    writeFileSync(join(root, 'result.json'), JSON.stringify({ ...file, identity: { sandboxDisabled: true } }));
    assert.throws(() => verifyFileOutcomes(root, 'whisper', options), /Sandbox/);
  } finally { rmSync(root, { recursive: true }); }
});
