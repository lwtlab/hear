const fullSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function resolveDispatch({ sourceRef, appRef, coreRef, defaultSourceRef, mode }) {
  return validateDispatch({
    sourceRef: sourceRef || (!appRef && !coreRef ? defaultSourceRef : ''),
    appRef, coreRef, mode,
  });
}
export function validateDispatch({ sourceRef, appRef, coreRef, mode }) {
  if (!['checks', 'candidate'].includes(mode)) throw new Error('Unsupported mode');
  if (sourceRef) {
    if (!fullSha(sourceRef) || appRef || coreRef) throw new Error('Use one full monorepo SHA or the historical app/core pair');
    return { layout: 'monorepo', sourceRef, appRef: sourceRef, coreRef: sourceRef, appPath: 'core/apps/hear' };
  }
  if (![appRef, coreRef].every(fullSha)) throw new Error('Full lowercase source SHAs are required');
  return { layout: 'legacy-pair', sourceRef: null, appRef, coreRef, appPath: 'app' };
}
export function sourcePaths(env = process.env) {
  return { app: env.SOURCE_LAYOUT === 'monorepo' ? 'core/apps/hear' : 'app', core: 'core' };
}
