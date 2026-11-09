import { sourcePaths } from './dispatch.mjs';
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [phase, cwd, command, ...args] = process.argv.slice(2);
if (!/^[a-z-]+$/.test(phase ?? '') || !['app', 'app/apps/desktop', 'core', 'core/hear-core'].includes(cwd) || !command) throw new Error('Invalid private step');
const paths = sourcePaths();
const actualCwd = cwd === 'app' ? paths.app : cwd === 'app/apps/desktop' ? join(paths.app, 'apps/desktop') : cwd;
const log = join(process.env.RUNNER_TEMP, 'hear-private.log');
appendFileSync(log, `\n--- ${phase} ---\n`, { mode: 0o600 });
const child = spawn(command, args, { shell: process.platform === 'win32' && command === 'pnpm', cwd: resolve(actualCwd), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => appendFileSync(log, chunk));
child.on('error', e => appendFileSync(log, `${e.stack}\n`));
const status = await new Promise(resolve => child.once('close', resolve));
if (status !== 0) { console.error(`${phase} failed; consult encrypted diagnostics`); process.exit(1); }
console.log(`${phase} passed`);
