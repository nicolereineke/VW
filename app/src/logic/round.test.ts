import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRoundWin, resetMembershipsForNewRound } from './round.js';
import type { TeamMembership } from '../types.js';

test('no winner while every team is under the target', () => {
  const winner = checkRoundWin({ reineke: 14, ouellette: 9 }, 21);
  assert.equal(winner, null);
});

test('the team that reaches the target exactly wins', () => {
  const winner = checkRoundWin({ reineke: 21, ouellette: 17 }, 21);
  assert.equal(winner, 'reineke');
});

test('a team that overshoots the target still wins (a Thing can jump past it)', () => {
  const winner = checkRoundWin({ reineke: 14, ouellette: 27 }, 21);
  assert.equal(winner, 'ouellette');
});

test('resetting a new round zeroes every member\'s points', () => {
  const memberships: TeamMembership[] = [
    { userId: 'u1', teamId: 't1', points: 12, joinedAt: 0 },
    { userId: 'u2', teamId: 't1', points: 9, joinedAt: 0 },
  ];
  const reset = resetMembershipsForNewRound(memberships);
  assert.deepEqual(
    reset.map((m) => m.points),
    [0, 0],
  );
});

test('resetting a round does not mutate the original array', () => {
  const memberships: TeamMembership[] = [{ userId: 'u1', teamId: 't1', points: 12, joinedAt: 0 }];
  resetMembershipsForNewRound(memberships);
  assert.equal(memberships[0]!.points, 12, 'original input must stay untouched');
});
