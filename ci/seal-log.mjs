import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encryptLog } from './log-crypto.mjs';
const log = join(process.env.RUNNER_TEMP, 'hear-private.log');
if (existsSync(log)) {
  try {
    mkdirSync('diagnostics', { recursive: true });
    writeFileSync('diagnostics/build-log.enc.json', JSON.stringify(encryptLog(readFileSync(log), process.env.HEAR_LOG_PUBLIC_KEY)));
  } finally { rmSync(log, { force: true }); }
}
