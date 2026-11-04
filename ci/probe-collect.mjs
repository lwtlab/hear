import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
const platform = `${process.platform}-${process.arch}`;
const root = 'app/apps/desktop/probe-release';
const folder = readdirSync(root).find(x => x.endsWith('-unpacked') || x === 'mac-arm64');
if (!folder) throw new Error('No diagnostic runtime directory');
mkdirSync('probe-artifact', { recursive: true });
const archive = `AIHearProbe-${platform}.tar.gz`;
execFileSync('tar', ['-czf', join('probe-artifact', archive), '-C', root, folder]);
const functional = join(process.env.RUNNER_TEMP, 'hear-file-functional/evidence');
if (existsSync(join(functional, 'result.json'))) {
  mkdirSync('probe-artifact/file-functional', { recursive: true });
  for (const name of readdirSync(functional).filter(n => /\.(?:json|png|txt|vtt|srt)$/.test(n))) {
    copyFileSync(join(functional, name), join('probe-artifact/file-functional', name));
  }
}
const bytes = readFileSync(join('probe-artifact', archive));
writeFileSync('probe-artifact/probe.json', JSON.stringify({ schemaVersion: 1, diagnostic: true, releaseAcceptance: false,
 platform, appRef: process.env.APP_REF, coreRef: process.env.CORE_REF,
 workflowRef: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
 nativeCheck: process.env.NATIVE_OUTCOME, nativeBuild: process.env.NATIVE_BUILD_OUTCOME, nativeReuse: process.env.NATIVE_REUSE_OUTCOME, nativeOrigin: existsSync("core/hear-core/native-origin.json") ? JSON.parse(readFileSync("core/hear-core/native-origin.json", "utf8")) : undefined, fileFunctional: process.env.FILE_FUNCTIONAL_OUTCOME, functionalRuntime: process.env.FUNCTIONAL_RUNTIME === "true", typecheck: process.env.TYPECHECK_OUTCOME,
 archive, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
 limitation: 'Diagnostic configuration and isolated product name. See nativeBuild/fileFunctional outcomes separately from nativeCheck. No microphone/system capture, dictation, release installer or signing acceptance.' }, null, 2));
