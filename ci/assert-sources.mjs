// Validate private checkouts without emitting their contents into public logs.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { sourcePaths } from './dispatch.mjs';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
try {
  const { app, core } = sourcePaths();
  if (git(app, 'rev-parse', 'HEAD') !== process.env.APP_REF || git(core, 'rev-parse', 'HEAD') !== process.env.CORE_REF)
    throw Error('Checkout identity mismatch');
  if (process.env.SOURCE_LAYOUT === 'monorepo' &&
      (process.env.APP_REF !== process.env.SOURCE_REF || process.env.CORE_REF !== process.env.SOURCE_REF ||
       realpathSync(git(app, 'rev-parse', '--show-toplevel')) !== realpathSync(core))) throw Error('Hear must belong to the checked-out monorepo');
  console.log('Pinned source identities verified');
} catch { console.error('Private checkout identity verification failed'); process.exitCode = 1; }
