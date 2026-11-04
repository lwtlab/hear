import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, copyFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
const platform = `${process.platform}-${process.arch}`;
const root = 'app/apps/desktop/probe-release';
const folder = readdirSync(root).find(x => x.endsWith('-unpacked') || x === 'mac-arm64');
if (!folder) throw new Error('No diagnostic runtime directory');
mkdirSync('probe-artifact', { recursive: true });
const archive = `AIHearProbe-${platform}.tar.gz`;
execFileSync('tar', ['-czf', join('probe-artifact', archive), '-C', root, folder]);
const functional = join(process.env.RUNNER_TEMP, 'hear-file-functional/evidence');
if (existsSync(functional)) {
  mkdirSync('probe-artifact/file-functional', { recursive: true });
  for (const name of readdirSync(functional, { recursive: true }).filter(n => /\.(?:json|png|txt|vtt|srt)$/.test(n) && lstatSync(join(functional, n)).isFile())) {
    mkdirSync(join('probe-artifact/file-functional', name, '..'), { recursive: true });
    copyFileSync(join(functional, name), join('probe-artifact/file-functional', name));
  }
}
const bytes = readFileSync(join('probe-artifact', archive));
const installers = readdirSync(root).filter(n => n.endsWith('.deb')).map(name => {
  const data = readFileSync(join(root, name));
  copyFileSync(join(root, name), join('probe-artifact', name));
  return { name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
});
const runtimeOrigin = existsSync(join(root, 'runtime-origin.json')) ? JSON.parse(readFileSync(join(root, 'runtime-origin.json'), 'utf8')) : undefined;
writeFileSync('probe-artifact/probe.json', JSON.stringify({ schemaVersion: 1, diagnostic: true, releaseAcceptance: false,
 platform, appRef: runtimeOrigin?.appRef ?? process.env.APP_REF, qaAppRef: process.env.APP_REF, coreRef: process.env.CORE_REF,
 workflowRef: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
 nativeCheck: process.env.NATIVE_OUTCOME, nativeBuild: process.env.NATIVE_BUILD_OUTCOME, nativeReuse: process.env.NATIVE_REUSE_OUTCOME, nativeOrigin: existsSync("core/hear-core/native-origin.json") ? JSON.parse(readFileSync("core/hear-core/native-origin.json", "utf8")) : undefined, fileFunctional: process.env.FILE_FUNCTIONAL_OUTCOME, functionalRuntime: process.env.FUNCTIONAL_RUNTIME === "true", typecheck: process.env.TYPECHECK_OUTCOME,
 archive, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
 installers, linuxInstall: process.env.LINUX_INSTALL_OUTCOME,
 runtimeCleanup: process.env.RUNTIME_CLEANUP_OUTCOME,
 runtimeOrigin, runtimeReuse: process.env.LINUX_RUNTIME_REUSE_OUTCOME,
 limitation: 'Diagnostic configuration and isolated product name. See nativeBuild/fileFunctional/linuxInstall outcomes separately from nativeCheck. Linux deb is a diagnostic installer. No microphone/system capture, dictation, release installer or signing acceptance.' }, null, 2));
