export async function closeOwnedPlayer({ waitReference, stopNativeChild, closePlayer }) {
  const failures = [];
  for (const action of [waitReference, stopNativeChild, closePlayer]) {
    try { await action(); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'Owned player cleanup failed');
}
