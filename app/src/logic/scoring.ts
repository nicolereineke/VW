import type { BodyStyle } from '../types.js';

export interface ScoringRules {
  rulesConvertibleMultiplier: boolean;
  rulesThingMultiplier: boolean;
}

/**
 * SPEC.md §4.2 — Bus is intentionally not a member of BodyStyle at the type
 * level, so "buses don't count" is enforced by the compiler, not a runtime check.
 */
export function pointsForCall(bodyStyle: BodyStyle, rules: ScoringRules): number {
  if (bodyStyle === 'Convertible') {
    return rules.rulesConvertibleMultiplier ? 2 : 1;
  }
  if (bodyStyle === 'Thing') {
    return rules.rulesThingMultiplier ? 10 : 1;
  }
  return 1;
}
