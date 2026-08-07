import { BUG_DEX_SIZE } from './colors.js';
import type { BodyStyle } from '../types.js';

export function bugDexKey(color: string, bodyStyle: BodyStyle): string {
  return `${color}|${bodyStyle}`;
}

export interface BugDexUpdateResult {
  dex: Set<string>;
  newFinds: string[];
  completion: number; // 0..1
}

/**
 * Records every color on a call against the given body style, returning which
 * combinations were newly discovered (for the "New Find!" celebration) versus
 * already known. Never requires a photo — this is a personal record, not a
 * competitive one (see SPEC.md §5, global leaderboard note).
 */
export function recordCallInBugDex(
  dex: Set<string>,
  colors: string[],
  bodyStyle: BodyStyle,
): BugDexUpdateResult {
  const next = new Set(dex);
  const newFinds: string[] = [];
  for (const color of colors) {
    const key = bugDexKey(color, bodyStyle);
    if (!next.has(key)) {
      newFinds.push(key);
    }
    next.add(key);
  }
  return { dex: next, newFinds, completion: next.size / BUG_DEX_SIZE };
}
