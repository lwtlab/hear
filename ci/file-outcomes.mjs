import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function verifyFileOutcomes(root, mode) {
  if (!['whisper', 'whisper-and-sensevoice'].includes(mode)) throw new Error('Unknown requested models');
  const models = [['', 'tiny.en'], ...(mode === 'whisper-and-sensevoice' ? [['sensevoice', 'sensevoice-small']] : [])];
  for (const [folder, id] of models) {
    let result; try { result = JSON.parse(readFileSync(join(root, folder, 'result.json'), 'utf8')); } catch { throw new Error(`Missing functional outcome for ${id}`); }
    if (result.status !== 'PASS' || result.model?.id !== id) throw new Error(`No passing functional outcome for ${id}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyFileOutcomes(join(process.env.RUNNER_TEMP, 'hear-file-functional/evidence'), process.env.CI_FILE_MODELS ?? 'whisper');
  console.log('Requested real model outcomes verified');
}
