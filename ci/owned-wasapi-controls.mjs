// Diagnostic-only interception of a newly owned test player; no product patches.
// Both capturers include this player's process tree. Never accept an external PID.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encryptLog } from './log-crypto.mjs';
import { waveSignal } from './owned-wave-signal.mjs';
import { ownedWindowProcess } from './owned-window-process.mjs';
assert.equal(process.platform, 'win32');
const mode = process.env.WASAPI_CONTROL_MODE; assert(['baseline', 'in-process-audio'].includes(mode));
const publicRoot = resolve(import.meta.dirname, '..');
const appRoot = join(publicRoot, 'core/apps/hear'), evidence = join(process.env.RUNNER_TEMP, 'hear-wasapi-owned');
const reference = join(publicRoot, 'reference/Samples/ApplicationLoopback/cpp/x64/Release/ApplicationLoopback.exe');
assert(lstatSync(reference).isFile());
const req = createRequire(join(appRoot, 'apps/desktop/package.json')), playwright = req('@playwright/test');
const originalLaunch = playwright._electron.launch.bind(playwright._electron);
const result = { diagnostic: true, releaseAcceptance: false, captureScope: 'owned-approved-sample-player-only', mode,
  referenceSource: '434f6002bdf9cf9829406c3ff2b33387982d6168', referenceSha256: createHash('sha256').update(readFileSync(reference)).digest('hex'), status: 'FAIL' };
let calls = 0, referenceDone, referenceChild, approvedWave;
playwright._electron.launch = async options => {
  assert.equal(++calls, 1); const main = options.args?.[0];
  assert.equal(basename(main), 'main.cjs'); assert.match(basename(dirname(main)), /^hear-owned-player-/);
  const args = mode === 'in-process-audio' ? [...options.args, '--disable-features=AudioServiceOutOfProcess'] : options.args;
  const app = await originalLaunch({ ...options, args });
  const originalFirstWindow = app.firstWindow.bind(app), originalClose = app.close.bind(app);
  app.firstWindow = async (...args) => {
    const page = await originalFirstWindow(...args);
    await page.waitForFunction(() => document.querySelector('audio')?.currentTime > 0);
    result.playback = await page.evaluate(() => { const audio = document.querySelector('audio'); return { paused: audio.paused, muted: audio.muted, volume: audio.volume, readyState: audio.readyState, currentTime: audio.currentTime }; });
    const windowId = await app.evaluate(({ BrowserWindow }) => {
      const handle = BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
      return Number(handle.length === 8 ? handle.readBigUInt64LE() : handle.readUInt32LE());
    });
    const launcherPid = app.process().pid; assert.equal(app.process().exitCode, null);
    const proof = JSON.parse(execFileSync('powershell', ['-NoProfile', '-File', join(import.meta.dirname, 'owned-window-process.ps1'), '-WindowId', String(windowId), '-LauncherPid', String(launcherPid)], { encoding: 'utf8', timeout: 15000, maxBuffer: 65536 }));
    const pid = ownedWindowProcess({ windowId, launcherPid, proof });
    result.windowOwnership = { launcherPid, ...proof };
    result.ownedPlayerPid = pid;
    result.ownedAppProcesses = await app.evaluate(({ app }) => app.getAppMetrics().map(metric => ({ pid: metric.pid, type: metric.type, serviceName: metric.serviceName })));
    referenceChild = spawn(reference, [String(pid), 'includetree', join(process.env.RUNNER_TEMP, 'owned-reference.wav')], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    let output = ''; for (const stream of [referenceChild.stdout, referenceChild.stderr]) stream.on('data', bytes => { if (output.length < 65536) output += bytes; });
    referenceDone = new Promise(resolve => { referenceChild.on('error', error => { result.referenceError = String(error); }); referenceChild.once('close', status => { result.referenceExit = status; result.referenceOutput = output; resolve(); }); });
    return page;
  };
  app.close = async () => { try { await referenceDone; } finally { await originalClose(); } };
  return app;
};
try {
  process.argv[2] = evidence;
  await import(pathToFileURL(join(appRoot, 'scripts/windows-owned-audio-probe.mjs')).href);
  await referenceDone;
  const bytes = readFileSync(join(process.env.RUNNER_TEMP, 'owned-reference.wav'));
  result.referencePcm = waveSignal(bytes); approvedWave = bytes;
  result.referenceAudioSha256 = createHash('sha256').update(bytes).digest('hex');
  result.status = result.referenceExit === 0 && result.referencePcm.validSignal ? 'PASS' : 'FAIL';
} catch (error) { result.error = String(error); console.error('Owned control failed; consult encrypted diagnostics'); }
finally {
  try { referenceChild?.kill(); } catch (error) { result.cleanupError = String(error); result.status = 'FAIL'; }
  playwright._electron.launch = originalLaunch;
  mkdirSync(join(publicRoot, 'diagnostics'), { recursive: true });
  writeFileSync(join(publicRoot, 'diagnostics/wasapi-controls.enc.json'), JSON.stringify(encryptLog(Buffer.from(JSON.stringify({ metadata: result, ...(approvedWave ? { waveBase64: approvedWave.toString('base64') } : {}) })), process.env.HEAR_LOG_PUBLIC_KEY)));
  // Fixed scalar fields only; errors and command output remain private.
  const receipt = { diagnostic: true, releaseAcceptance: false, captureScope: result.captureScope, mode,
    sourceRef: process.env.SOURCE_REF, appPath: 'apps/hear', workflowRef: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    referenceSource: result.referenceSource, referenceSha256: result.referenceSha256, referenceStatus: result.status,
    referenceAudioSha256: result.referenceAudioSha256, referencePcm: result.referencePcm, playback: result.playback };
  writeFileSync(join(process.env.RUNNER_TEMP, 'owned-control-receipt.json'), JSON.stringify(receipt));
  console.log(`Owned reference control: ${result.status}; no release acceptance`);
}
