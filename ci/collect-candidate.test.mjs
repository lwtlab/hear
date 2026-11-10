import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
const script = resolve(import.meta.dirname, 'collect-candidate.mjs');
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'hear-collector-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  for (const path of [root, join(root, 'app'), join(root, 'core')]) {
    mkdirSync(path, { recursive: true }); git(path, 'init');
    git(path, '-c', 'user.email=test@example.invalid', '-c', 'user.name=Test', 'commit', '--allow-empty', '-m', 'fixture');
  }
  const release = join(root, 'app/apps/desktop/release'); mkdirSync(release, { recursive: true });
  writeFileSync(join(release, 'AIHear-2.0.0-arm64.dmg'), 'synthetic dmg');
  writeFileSync(join(release, 'AIHear-2.0.0-arm64-mac.zip'), 'synthetic zip');
  writeFileSync(join(release, 'latest-mac.yml'), 'private feed omitted');
  writeFileSync(join(release, 'source.ts'), 'private source omitted');
  writeFileSync(join(root, 'app/apps/desktop/package.json'), '{"version":"2.0.0"}');
  git(join(root, 'app'), 'add', '.');
  git(join(root, 'app'), '-c', 'user.email=test@example.invalid', '-c', 'user.name=Test', 'commit', '-m', 'candidate inputs');
  return { root, release, env: { ...process.env, APP_REF: git(join(root, 'app'), 'rev-parse', 'HEAD'), CORE_REF: git(join(root, 'core'), 'rev-parse', 'HEAD') } };
}
test('candidate contains only explicit packages and verifiable source/checksum metadata', t => {
  const { root, env } = setup(t);
  const r = spawnSync(process.execPath, [script], { cwd: root, env }); assert.equal(r.status, 0, r.stderr.toString());
  assert.deepEqual(readdirSync(join(root, 'candidate')).sort(), ['AIHear-2.0.0-arm64-mac.zip', 'AIHear-2.0.0-arm64.dmg', 'candidate.json']);
  const m = JSON.parse(readFileSync(join(root, 'candidate/candidate.json')));
  assert.equal(m.appRef, env.APP_REF); assert.equal(m.coreRef, env.CORE_REF);
  assert.equal(m.distribution, 'unsigned-ci-candidate'); assert.equal(m.acceptance.realAudio, 'NOT RUN');
  assert.ok(m.assets.every(a => /^[a-f0-9]{64}$/.test(a.sha256) && a.bytes > 0));
});
test('candidate rejects mismatched source and symlink assets', t => {
  const { root, release, env } = setup(t);
  assert.notEqual(spawnSync(process.execPath, [script], { cwd: root, env: { ...env, APP_REF: '0'.repeat(40) } }).status, 0);
  const dmg = join(release, 'AIHear-2.0.0-arm64.dmg'); rmSync(dmg); symlinkSync(join(release, 'source.ts'), dmg);
  assert.notEqual(spawnSync(process.execPath, [script], { cwd: root, env }).status, 0);
});

test('candidate rejects tracked source mutation during build', t => {
  const { root, env } = setup(t);
  writeFileSync(join(root, 'app/apps/desktop/package.json'), '{"version":"9.9.9"}');
  assert.notEqual(spawnSync(process.execPath, [script], { cwd: root, env }).status, 0);
});
test('monorepo candidates bind application and core to one private source commit', t => {
  const { root, env } = setup(t);
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const app = join(root, 'core/apps/hear');
  mkdirSync(app, { recursive: true });
  const release = join(app, 'apps/desktop/release'); mkdirSync(release, { recursive: true });
  writeFileSync(join(release, 'AIHear-2.0.0-arm64.dmg'), 'synthetic dmg');
  writeFileSync(join(release, 'AIHear-2.0.0-arm64.zip'), 'synthetic zip');
  writeFileSync(join(app, 'apps/desktop/package.json'), '{"version":"2.0.0"}');
  writeFileSync(join(root, 'core/.gitignore'), 'hear-core/native-origin.json\nhear-core/*.node\n');
  git(join(root, 'core'), 'add', '.');
  git(join(root, 'core'), '-c', 'user.email=test@example.invalid', '-c', 'user.name=Test', 'commit', '-m', 'monorepo inputs');
  const sourceRef = git(join(root, 'core'), 'rev-parse', 'HEAD');
  const nativeDir = join(root, 'core/hear-core'); mkdirSync(nativeDir, { recursive: true });
  const binary = 'synthetic native';
  writeFileSync(join(nativeDir, 'hear-core.darwin-arm64.node'), binary);
  const origin = { kind: 'hear-native-build', coreRef: sourceRef, clean: true, platform: 'darwin', arch: 'arm64',
    filename: 'hear-core.darwin-arm64.node', napi: '10', sha256: createHash('sha256').update(binary).digest('hex') };
  writeFileSync(join(nativeDir, 'native-origin.json'), JSON.stringify(origin));
  const selected = { ...env, SOURCE_LAYOUT: 'monorepo', SOURCE_REF: sourceRef, APP_REF: sourceRef, CORE_REF: sourceRef };
  assert.equal(spawnSync(process.execPath, [resolve(import.meta.dirname, 'assert-sources.mjs')], { cwd: root, env: selected }).status, 0);
  const r = spawnSync(process.execPath, [script], { cwd: root, env: selected });
  assert.equal(r.status, 0, r.stderr.toString());
  const manifest = JSON.parse(readFileSync(join(root, 'candidate/candidate.json')));
  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(manifest.source, { repository: 'lwtlab/lwt-core', commit: sourceRef, appPath: 'apps/hear' });
  assert.equal(manifest.appRef, sourceRef); assert.equal(manifest.coreRef, sourceRef);
  assert.deepEqual(manifest.nativeOrigin, origin);
  writeFileSync(join(nativeDir, 'hear-core.darwin-arm64.node'), 'different native');
  assert.notEqual(spawnSync(process.execPath, [script], { cwd: root, env: selected }).status, 0);
});
