import assert from 'node:assert/strict';
import test from 'node:test';
import { closeOwnedPlayer } from './owned-player-cleanup.mjs';
test('player close waits for owned child termination and still executes after failure', async () => {
  const actions = [];
  await assert.rejects(closeOwnedPlayer({
    waitReference: async () => { actions.push('reference'); },
    stopNativeChild: async () => { await Promise.resolve(); actions.push('child'); throw Error('stop failed'); },
    closePlayer: async () => { actions.push('player'); },
  }), /cleanup failed/);
  assert.deepEqual(actions, ['reference', 'child', 'player']);
});
