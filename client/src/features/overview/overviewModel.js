// Turns GET /api/overview into what the screen shows: the "Needs attention" list, the branch
// list and the status filter from the URL. Pure functions, so the rules are tested without a DOM.

import { STATUS_ORDER } from '@chilllog/shared';
import { fridgeType } from '../../shared/fridgeType.js';

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

// How each problem is counted in words: "1 gap", "2 gaps", "1 warming", "1 without a file".
const COUNT_WORDS = {
  alert: ['alert', 'alerts'],
  warming: ['warming', 'warming'],
  gap: ['gap', 'gaps'],
  no_file: ['without a file', 'without a file'],
};

/**
 * A branch's state in words, worst first: "1 alert, 1 gap", "No file this week" or "All OK", so
 * the branch reads at a glance without decoding icons. The fridge count is shown separately.
 */
export function branchSummary(branch) {
  if (branch.fridges.every((f) => f.status === 'no_file')) return 'No file this week';
  const problems = STATUS_ORDER.filter((status) => status !== 'ok')
    .map((status) => [status, branch.fridges.filter((f) => f.status === status).length])
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${n} ${COUNT_WORDS[status][n === 1 ? 0 : 1]}`);
  return problems.length ? problems.join(', ') : 'All OK';
}

export { fridgeType };

const byName = (a, b) => a.localeCompare(b);

/**
 * The Branch and Type filters' options, from the branches in the database (GET /api/branches),
 * so a branch just added in Setup is listed even before it has fridges. Each list offers only
 * what the other filter allows (with Beersheba chosen, Type lists Beersheba's types). The chosen
 * values always stay in their lists, even an impossible pair from a bookmarked URL.
 * @param {Array<{ id: number, name: string, fridges: Array<{ name: string }> }>} branches
 */
export function placeFilterOptions(branches, place) {
  const typesOf = (branch) => branch.fridges.map((f) => fridgeType(f.name));
  const branchOptions = branches
    .filter(
      (b) => place.type === null || b.id === place.branchId || typesOf(b).includes(place.type),
    )
    .map((b) => ({ id: b.id, name: b.name }))
    .sort((a, b) => byName(a.name, b.name));
  const inBranch = branches.filter((b) => place.branchId === null || b.id === place.branchId);
  const types = new Set(inBranch.flatMap(typesOf));
  if (place.type !== null) types.add(place.type);
  return { branches: branchOptions, types: [...types].sort(byName) };
}

/** The fridges in the chosen branch, of the chosen type and with the chosen status (null = any). */
export function filterFridges(fridges, { branchId, type, status = null }) {
  return fridges.filter(
    (f) =>
      (branchId === null || f.branchId === branchId) &&
      (type === null || fridgeType(f.fridgeName) === type) &&
      (status === null || f.status === status),
  );
}

/** How many fridges have each status, so the chips can follow the Branch and Type filters. */
export function countByStatus(fridges) {
  return Object.fromEntries(
    STATUS_ORDER.map((status) => [status, fridges.filter((f) => f.status === status).length]),
  );
}

/** The ?branch= and ?type= filters from the URL (null when not set or not valid). */
export function readPlaceFilter(params) {
  const branch = params.get('branch');
  const type = params.get('type');
  return {
    branchId: branch && /^\d+$/.test(branch) ? Number(branch) : null,
    type: type || null,
  };
}

/** The ?status= filter, or null when it's missing or not a real status. */
export function readStatusFilter(value) {
  return STATUS_ORDER.includes(value) ? value : null;
}
