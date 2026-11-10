import assert from 'node:assert/strict';
export function ownedWindowProcess({ windowId, launcherPid, proof }) {
  const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff;
  assert(positive(windowId) && positive(launcherPid)); assert.equal(proof?.windowId, windowId);
  assert(positive(proof.processId)); const chain = proof.processChain;
  assert(Array.isArray(chain) && chain.length > 0 && chain.length <= 16 && chain.every(positive));
  assert.equal(new Set(chain).size, chain.length); assert.equal(chain[0], proof.processId);
  assert.equal(chain.at(-1), launcherPid);
  return proof.processId;
}
