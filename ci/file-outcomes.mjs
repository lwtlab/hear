import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function verifyFileOutcomes(root, mode, { requireSandbox = false } = {}) {
  if (!['whisper', 'whisper-and-sensevoice'].includes(mode)) throw new Error('Unknown requested models');
  const models = [['', 'tiny.en'], ...(mode === 'whisper-and-sensevoice' ? [['sensevoice', 'sensevoice-small']] : [])];
  for (const [folder, id] of models) {
    let result; try { result = JSON.parse(readFileSync(join(root, folder, 'result.json'), 'utf8')); } catch { throw new Error(`Missing functional outcome for ${id}`); }
    if (result.status !== 'PASS' || result.model?.id !== id) throw new Error(`No passing functional outcome for ${id}`);
    if (requireSandbox && (result.requireSandbox !== true || result.identity?.sandboxDisabled !== false)) throw new Error(`Sandbox was not required and retained for ${id}`);
  }
  if (requireSandbox) {
    const ordinary = JSON.parse(readFileSync(join(root, 'linux-installed/ordinary-launch.json'), 'utf8'));
    if (ordinary.status !== 'PASS' || ordinary.restrictedUserNamespaces !== '1' ||
        !ordinary.appArmor?.startsWith('aihear-probe ') || !Array.isArray(ordinary.arguments) || ordinary.arguments.length ||
        !ordinary.renderers?.length || !ordinary.renderers.every(p => p.Seccomp === '2' && p.NoNewPrivs === '1')) {
      throw new Error('No passing ordinary installed launch under strict sandbox restrictions');
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyFileOutcomes(join(process.env.RUNNER_TEMP, 'hear-file-functional/evidence'), process.env.CI_FILE_MODELS ?? 'whisper', { requireSandbox: process.env.HEAR_PROBE_REQUIRE_SANDBOX === '1' });
  console.log('Requested real model outcomes verified');
}
