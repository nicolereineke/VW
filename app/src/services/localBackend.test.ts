import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalBackend } from './localBackend.js';

async function registerUser(backend: LocalBackend, identifier: string, name: string) {
  await backend.requestOtp(identifier, identifier.includes('@') ? 'email' : 'phone');
  const code = backend.__debugGetLastOtp(identifier)!;
  return backend.verifyOtp(identifier, code, name);
}

test('verifying with the wrong code fails, with the right code succeeds', async () => {
  const backend = new LocalBackend();
  await backend.requestOtp('nicole@example.com', 'email');
  await assert.rejects(() => backend.verifyOtp('nicole@example.com', '000000', 'Nicole'));
  const user = await registerUser(new LocalBackend(), 'nicole@example.com', 'Nicole');
  assert.equal(user.displayName, 'Nicole');
  assert.equal(user.lifetimePoints, 0);
});

test('re-verifying the same identifier returns the existing account, not a new one', async () => {
  const backend = new LocalBackend();
  const first = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const second = await registerUser(backend, 'nicole@example.com', 'Nicole again');
  assert.equal(first.id, second.id);
});

test('creating a rivalry makes the creator the first team, pending a rival', async () => {
  const backend = new LocalBackend();
  const nicole = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const { rivalry, team } = await backend.createRivalry(nicole.id, 'Team Reineke');
  assert.equal(rivalry.status, 'pending');
  assert.equal(team.colorRole, 'primary');
  assert.match(rivalry.inviteCode, /^RIVAL-/);
});

test('redeeming a RIVAL code creates the second team and activates the rivalry', async () => {
  const backend = new LocalBackend();
  const nicole = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const { rivalry } = await backend.createRivalry(nicole.id, 'Team Reineke');

  const daniel = await registerUser(backend, 'daniel@example.com', 'Daniel');
  const joined = await backend.redeemInviteCode(daniel.id, rivalry.inviteCode, 'Daniel');
  assert.ok(joined);
  assert.equal(joined!.team.colorRole, 'secondary');
  assert.equal(joined!.rivalry.status, 'active');
});

test('a second person redeeming the same RIVAL code joins the same secondary team as a teammate', async () => {
  const backend = new LocalBackend();
  const nicole = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const { rivalry } = await backend.createRivalry(nicole.id, 'Team Reineke');
  const daniel = await registerUser(backend, 'daniel@example.com', 'Daniel');
  const roger = await registerUser(backend, 'roger@example.com', 'Roger');
  const first = await backend.redeemInviteCode(daniel.id, rivalry.inviteCode, 'Daniel');
  const second = await backend.redeemInviteCode(roger.id, rivalry.inviteCode, 'Roger');
  assert.equal(first!.team.id, second!.team.id);
});

test('an unrecognized code is rejected, not silently ignored', async () => {
  const backend = new LocalBackend();
  const user = await registerUser(backend, 'nicole@example.com', 'Nicole');
  await assert.rejects(() => backend.redeemInviteCode(user.id, 'RIVAL-NOPE', 'Nicole'));
});

test('no code at all resolves as solo — a valid outcome, not an error', async () => {
  const backend = new LocalBackend();
  const user = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const result = await backend.redeemInviteCode(user.id, '', 'Nicole');
  assert.equal(result, null);
});

test('a solo call updates personal stats without needing a team', async () => {
  const backend = new LocalBackend();
  const user = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const trip = await backend.startTrip(user.id, null);
  const result = await backend.logCall({
    tripId: trip.id,
    userId: user.id,
    colors: ['Kasan Red'],
    bodyStyle: 'Beetle',
  });
  assert.equal(result.call.points, 1);
  assert.equal(result.roundWinnerTeamId, null);
  const refetched = await backend.getUser(user.id);
  assert.equal(refetched!.lifetimePoints, 1);
  assert.ok(refetched!.bugDex.has('Kasan Red|Beetle'));
});

test('a Thing call in a rivalry can win the round outright and resets both teams for the next one', async () => {
  const backend = new LocalBackend();
  const nicole = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const { rivalry, team: reineke } = await backend.createRivalry(nicole.id, 'Team Reineke');
  const daniel = await registerUser(backend, 'daniel@example.com', 'Daniel');
  await backend.redeemInviteCode(daniel.id, rivalry.inviteCode, 'Daniel');

  const trip = await backend.startTrip(nicole.id, reineke.id);
  // Two ordinary Beetles (2 pts) then a Thing (10 pts) = 12, still under 21.
  await backend.logCall({ tripId: trip.id, userId: nicole.id, colors: ['Kasan Red'], bodyStyle: 'Beetle' });
  await backend.logCall({ tripId: trip.id, userId: nicole.id, colors: ['Marina Blue'], bodyStyle: 'Beetle' });
  let result = await backend.logCall({ tripId: trip.id, userId: nicole.id, colors: ['Bahia Red'], bodyStyle: 'Thing' });
  assert.equal(result.roundWinnerTeamId, null, 'still under the 21-point target');

  // A second Thing pushes 12 -> 22, past the target.
  result = await backend.logCall({ tripId: trip.id, userId: nicole.id, colors: ['Amber'], bodyStyle: 'Thing' });
  assert.equal(result.roundWinnerTeamId, reineke.id);

  // The next call for this team starts a fresh round at 0, not 22.
  const nextCallTrip = await backend.startTrip(nicole.id, reineke.id);
  const next = await backend.logCall({
    tripId: nextCallTrip.id,
    userId: nicole.id,
    colors: ['Pastel White'],
    bodyStyle: 'Beetle',
  });
  const round = await backend.getRound(next.call.roundId!);
  assert.equal(round!.teamScores[reineke.id], 1, 'the new round only has this one call in it');
});

test('only a photo-verified call counts toward the global leaderboard', async () => {
  const backend = new LocalBackend();
  const user = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const trip = await backend.startTrip(user.id, null);
  await backend.logCall({ tripId: trip.id, userId: user.id, colors: ['Kasan Red'], bodyStyle: 'Beetle' });
  await backend.logCall({
    tripId: trip.id,
    userId: user.id,
    colors: ['Olympic Blue'],
    bodyStyle: 'Convertible',
    photoUrl: 'https://example.com/photo.jpg',
  });
  const refetched = await backend.getUser(user.id);
  assert.equal(refetched!.lifetimePoints, 3, 'both calls count toward the personal lifetime total');
  assert.equal(refetched!.globalWeeklyPoints, 2, 'only the photographed Convertible counts globally');

  const board = await backend.getLeaderboard('weekly');
  assert.equal(board.length, 1);
  assert.equal(board[0]!.points, 2);
});

test('a ruling both teams agree on resolves; a split falls back to house rules, not a stuck vote', async () => {
  const backend = new LocalBackend();
  const nicole = await registerUser(backend, 'nicole@example.com', 'Nicole');
  const { rivalry, team: reineke } = await backend.createRivalry(nicole.id, 'Team Reineke');
  const daniel = await registerUser(backend, 'daniel@example.com', 'Daniel');
  const { team: ouellette } = (await backend.redeemInviteCode(daniel.id, rivalry.inviteCode, 'Daniel'))!;

  const agreed = await backend.proposeRuling(rivalry.id, 'Does a Beetle on blocks count?');
  await backend.castVote(agreed.id, reineke.id, 'yes');
  const resolvedAgreed = await backend.castVote(agreed.id, ouellette.id, 'yes');
  assert.ok(resolvedAgreed.resolvedVerdict);

  const disputed = await backend.proposeRuling(rivalry.id, 'Was that really a Bug?');
  await backend.castVote(disputed.id, reineke.id, 'yes');
  const resolvedSplit = await backend.castVote(disputed.id, ouellette.id, 'no');
  assert.match(resolvedSplit.resolvedVerdict!, /no consensus/i);
});
