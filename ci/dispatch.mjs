export function validateDispatch({ appRef, coreRef, mode }) {
  if (![appRef, coreRef].every(x => /^[a-f0-9]{40}$/.test(x ?? ''))) throw new Error('Full lowercase source SHAs are required');
  if (!['checks', 'candidate'].includes(mode)) throw new Error('Unsupported mode');
}
