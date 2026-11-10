import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { encryptLog, decryptLog } from './log-crypto.mjs';

test('only the recipient can open a log and tampering is rejected', () => {
  const recipient = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const plaintext = Buffer.from('synthetic private build details');
  const sealed = encryptLog(plaintext, recipient.publicKey);
  assert.ok(!JSON.stringify(sealed).includes(plaintext.toString()));
  assert.deepEqual(decryptLog(sealed, recipient.privateKey), plaintext);
  assert.throws(() => decryptLog(sealed, other.privateKey));
  const bytes = Buffer.from(sealed.data, 'base64'); bytes[0] ^= 1;
  assert.throws(() => decryptLog({ ...sealed, data: bytes.toString('base64') }, recipient.privateKey));
});
