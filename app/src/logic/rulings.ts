import type { Vote } from '../types.js';

export type RulingOutcome =
  | { kind: 'pending' }
  | { kind: 'confirmed'; verdict: string }
  | { kind: 'rejected'; verdict: string }
  | { kind: 'split'; verdict: string };

/**
 * SPEC.md §4.3. Both teams cast exactly one vote each. A split decision is a
 * resolved state, not a stuck one — it falls back to "each team's own call
 * stands," mirroring the source rules' "House Rules Override Other Rules."
 */
export function resolveRuling(teamAVote: Vote, teamBVote: Vote): RulingOutcome {
  if (teamAVote === null || teamBVote === null) {
    return { kind: 'pending' };
  }
  if (teamAVote === 'yes' && teamBVote === 'yes') {
    return { kind: 'confirmed', verdict: 'Yes — the rivalry agrees. It counts.' };
  }
  if (teamAVote === 'no' && teamBVote === 'no') {
    return { kind: 'rejected', verdict: 'No — the rivalry agrees. It doesn’t count.' };
  }
  return {
    kind: 'split',
    verdict:
      'SPLIT DECISION — no consensus. Per House Rules Override Other Rules, each team’s own call stands at home.',
  };
}
