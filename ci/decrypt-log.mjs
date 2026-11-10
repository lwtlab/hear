import { readFileSync, writeFileSync } from 'node:fs';
import { decryptLog } from './log-crypto.mjs';
const [envelope, key, output] = process.argv.slice(2);
if (!envelope || !key || !output) throw new Error('Usage: node ci/decrypt-log.mjs envelope.json private.pem output.log');
writeFileSync(output, decryptLog(JSON.parse(readFileSync(envelope, 'utf8')), readFileSync(key)), { mode: 0o600, flag: 'wx' });
