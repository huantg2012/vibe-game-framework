/** Reconcile late or adjacent pickups missed by a target-specific search log.
 * Read-only QA accounting: actual field transitions and the same settled save
 * are both required. This never supplies input, loot, resources or approval.
 */
export function reconcileTerminalPickups(journey) {
  const beforeInventory = journey.entrySave?.state?.inventory;
  const afterInventory = journey.afterReturn?.state?.inventory;
  const beforeRun = beforeInventory?.run, afterRun = afterInventory?.run;
  const terminal = journey.fieldResult, entry = journey.entryState;
  if (journey.outcome !== 'extract' || terminal?.ended !== true
    || !beforeRun?.id || beforeRun.status !== 'active' || beforeRun.id !== afterRun?.id
    || afterRun.status !== 'settled' || afterRun.outcome !== 'extract' || !afterRun.baseSettled
    || !(terminal.elapsedMs > entry?.elapsedMs)
    || !journey.searches?.some(search => search.searchDecision?.attempted === true)) return [];

  const terminalNodes = terminal.nodes ?? [];
  if (new Set(terminalNodes.map(node => node.id)).size !== terminalNodes.length) return [];
  const recorded = new Set(journey.searches.filter(search => search.collected).map(search => search.id));
  const results = [];
  for (const node of terminalNodes) {
    if (recorded.has(node.id) || node.collected !== true) continue;
    const starts = (entry.nodes ?? []).filter(candidate => candidate.id === node.id);
    if (starts.length !== 1) continue;
    const start = starts[0];
    if (start.collected !== false || start.kind !== node.kind || start.tier !== node.tier
      || start.pos?.x !== node.pos?.x || start.pos?.y !== node.pos?.y) continue;
    const distance = Math.hypot(node.pos.x - entry.pos.x, node.pos.y - entry.pos.y);
    if (!Number.isFinite(distance) || distance <= 320) continue;

    let settledProof;
    if (node.kind === 'kindling') {
      if (entry.carried !== 0 || !(terminal.carried > 0) || afterRun.kindlingGained !== terminal.carried) continue;
      settledProof = { kindlingGained: afterRun.kindlingGained };
    } else if (node.kind === 'contaminant') {
      if (Object.hasOwn(beforeRun.revealedNodes ?? {}, node.id)) continue;
      const ids = afterRun.revealedNodes?.[node.id];
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) continue;
      if (!ids.every(id => afterRun.returnedIds?.includes(id)
        && !beforeInventory.items?.some(item => item.id === id)
        && afterInventory.items?.some(item => item.id === id && item.source?.runId === beforeRun.id
          && item.source?.nodeId === node.id && item.location?.kind === 'stash'))) continue;
      settledProof = { returnedIds: [...ids] };
    } else continue;
    results.push({ id: node.id, distanceFromEntry: distance, elapsedMs: terminal.elapsedMs,
      timing: 'terminal upper bound; exact completion time was not captured',
      evidence: 'entry-uncollected / terminal-collected / same-run-settled', settledProof });
  }
  return results;
}
