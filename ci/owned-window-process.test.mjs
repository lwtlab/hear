import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedWindowProcess } from './owned-window-process.mjs';
test('owned HWND can belong to the launched process or its verified descendant', () => {
  const query = { windowId: 10, launcherPid: 20 };
  assert.equal(ownedWindowProcess({ ...query, proof: { windowId: 10, processId: 20, processChain: [20] } }), 20);
  assert.equal(ownedWindowProcess({ ...query, proof: { windowId: 10, processId: 30, processChain: [30, 25, 20] } }), 30);
  for (const proof of [
    { windowId: 11, processId: 20, processChain: [20] },
    { windowId: 10, processId: 30, processChain: [30, 40] },
    { windowId: 10, processId: 30, processChain: [30, 30, 20] },
    { windowId: 10, processId: 0, processChain: [0, 20] },
  ]) assert.throws(() => ownedWindowProcess({ ...query, proof }));
});
