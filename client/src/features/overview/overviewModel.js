// Turns GET /api/overview into what the screen shows: the "Needs attention" list, the branch
// list and the status filter from the URL. Pure functions, so the rules are tested without a DOM.

import { STATUS_ORDER } from '@chilllog/shared';

const rank = (status) => STATUS_ORDER.indexOf(status);

/** Worst status first, then branch and fridge by name (the same order the server uses). */
export function sortWorstFirst(fridges) {
  return [...fridges].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      a.branchName.localeCompare(b.branchName) ||
      a.fridgeName.localeCompare(b.fridgeName),
  );
}

/**
 * Every fridge that isn't OK, worst first. When a whole branch sent no file this week, it shows
 * as one card for the branch instead of one card per fridge.
 * @returns {Array<{ kind: 'fridge', fridge: object }
 *   | { kind: 'branch', branchId: number, branchName: string, fridgeCount: number }>}
 */
export function needsAttention(fridges) {
  const total = new Map();
  const missing = new Map();
  for (const f of fridges) {
    total.set(f.branchId, (total.get(f.branchId) ?? 0) + 1);
    if (f.status === 'no_file') missing.set(f.branchId, (missing.get(f.branchId) ?? 0) + 1);
  }
  const wholeBranchMissing = (id) => total.get(id) > 1 && missing.get(id) === total.get(id);

  const items = [];
  const branchCardAdded = new Set();
  for (const f of sortWorstFirst(fridges)) {
    if (f.status === 'ok') continue;
    if (f.status === 'no_file' && wholeBranchMissing(f.branchId)) {
      if (branchCardAdded.has(f.branchId)) continue;
      branchCardAdded.add(f.branchId);
      items.push({
        kind: 'branch',
        branchId: f.branchId,
        branchName: f.branchName,
        fridgeCount: total.get(f.branchId),
      });
      continue;
    }
    items.push({ kind: 'fridge', fridge: f });
  }
  return items;
}

/**
 * Branches by name, each with its fridges by name and its worst fridge (for the branch's pill).
 * @returns {Array<{ branchId: number, branchName: string, fridges: object[], worst: object }>}
 */
export function groupBranches(fridges) {
  const byBranch = new Map();
  for (const f of fridges) {
    if (!byBranch.has(f.branchId)) {
      byBranch.set(f.branchId, { branchId: f.branchId, branchName: f.branchName, fridges: [] });
    }
    byBranch.get(f.branchId).fridges.push(f);
  }
  return [...byBranch.values()]
    .sort((a, b) => a.branchName.localeCompare(b.branchName))
    .map((branch) => ({
      ...branch,
      fridges: branch.fridges.sort((a, b) => a.fridgeName.localeCompare(b.fridgeName)),
      worst: sortWorstFirst(branch.fridges)[0],
    }));
}

/** The ?status= filter, or null when it's missing or not a real status. */
export function readStatusFilter(value) {
  return STATUS_ORDER.includes(value) ? value : null;
}
