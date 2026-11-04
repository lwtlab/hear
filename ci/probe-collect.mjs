import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const platform = `${process.platform}-${process.arch}`;
const root = 'app/apps/desktop/probe-release';
const folder = readdirSync(root).find(x => x.endsWith('-unpacked') || x === 'mac-arm64');
if (!folder) throw new Error('No diagnostic runtime directory');
mkdirSync('probe-artifact', { recursive: true });
const archive = `AIHearProbe-${platform}.tar.gz`;
execFileSync('tar', ['-czf', join(process.cwd(), 'probe-artifact', archive), '-C', root, folder]);
const bytes = readFileSync(join('probe-artifact', archive));
writeFileSync('probe-artifact/probe.json', JSON.stringify({ schemaVersion: 1, diagnostic: true, releaseAcceptance: false,
 platform, appRef: process.env.APP_REF, coreRef: process.env.CORE_REF,
 workflowRef: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
 nativeCheck: process.env.NATIVE_OUTCOME, typecheck: process.env.TYPECHECK_OUTCOME,
 archive, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
 limitation: 'Diagnostic configuration and isolated product name; native cargo check is separate from packaged module availability; no real speech or capture acceptance.' }, null, 2));
