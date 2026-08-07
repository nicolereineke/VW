import type { TeamMembership } from '../types.js';

/**
 * SPEC.md §4.8. Checked after every call submission, not on a timer — the
 * instant any team's score crosses the target, the round is over.
 */
export function checkRoundWin(
  teamScores: Record<string, number>,
  target: number,
): string | null {
  for (const [teamId, score] of Object.entries(teamScores)) {
    if (score >= target) return teamId;
  }
  return null;
}

/**
 * Starting a new round zeroes each member's round tally. It never touches
 * User-level fields (lifetimePoints, bugDex, streak, global leaderboard
 * points) — those are permanent records that outlive any single round, and
 * this function has no access to them by construction: TeamMembership
 * doesn't carry those fields.
 */
export function resetMembershipsForNewRound(
  memberships: TeamMembership[],
): TeamMembership[] {
  return memberships.map((m) => ({ ...m, points: 0 }));
}
