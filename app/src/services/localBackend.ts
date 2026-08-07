import type {
  BackendService,
  LogCallInput,
  LogCallResult,
  RivalryRules,
  Unsubscribe,
} from './backend.js';
import type {
  Call,
  ContactMethod,
  LeaderboardEntry,
  Ruling,
  Rivalry,
  Round,
  Team,
  TeamMembership,
  Trip,
  User,
  Vote,
} from '../types.js';
import { pointsForCall } from '../logic/scoring.js';
import { resolveRuling } from '../logic/rulings.js';
import { checkStreakOnOpen, extendStreakOnCall, toIsoDate } from '../logic/streak.js';
import { recordCallInBugDex } from '../logic/bugdex.js';
import { classifyInviteCode } from '../logic/invite.js';
import { checkRoundWin, resetMembershipsForNewRound } from '../logic/round.js';

const DEFAULT_RULES = { rulesConvertibleMultiplier: true, rulesThingMultiplier: true };

function newId(): string {
  return crypto.randomUUID();
}

function randomCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${suffix}`;
}

function membershipKey(teamId: string, userId: string): string {
  return `${teamId}:${userId}`;
}

/**
 * In-memory implementation of BackendService. Used for all development and
 * the full test suite. Deliberately has no persistence — every process
 * restart starts clean, which is exactly right for a test double.
 */
export class LocalBackend implements BackendService {
  private users = new Map<string, User>();
  private identifierToUserId = new Map<string, string>();
  private pendingOtps = new Map<string, string>();
  private rivalries = new Map<string, Rivalry>();
  private teams = new Map<string, Team>();
  private memberships = new Map<string, TeamMembership>();
  private rounds = new Map<string, Round>();
  private currentRoundByRivalry = new Map<string, string>();
  private trips = new Map<string, Trip>();
  private calls = new Map<string, Call>();
  private rulings = new Map<string, Ruling>();
  private rivalrySubscribers = new Map<string, Set<(r: Rivalry) => void>>();
  private roundSubscribers = new Map<string, Set<(r: Round) => void>>();

  /** Test-only hook — a real backend sends this over SMS/email, it never returns it. */
  __debugGetLastOtp(identifier: string): string | undefined {
    return this.pendingOtps.get(identifier);
  }

  async requestOtp(identifier: string, _method: ContactMethod): Promise<void> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.pendingOtps.set(identifier, code);
  }

  async verifyOtp(identifier: string, code: string, displayName: string): Promise<User> {
    const expected = this.pendingOtps.get(identifier);
    if (!expected || expected !== code) {
      throw new Error('Invalid or expired code.');
    }
    this.pendingOtps.delete(identifier);

    const existingId = this.identifierToUserId.get(identifier);
    if (existingId) {
      const existing = this.users.get(existingId);
      if (existing) return existing;
    }

    const method: ContactMethod = identifier.includes('@') ? 'email' : 'phone';
    const user: User = {
      id: newId(),
      displayName,
      authMethod: method,
      authIdentifier: identifier,
      createdAt: Date.now(),
      lifetimePoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      bugDex: new Set(),
      globalWeeklyPoints: 0,
      globalAnnualPoints: 0,
      activeRivalryId: null,
      activeTeamId: null,
    };
    this.users.set(user.id, user);
    this.identifierToUserId.set(identifier, user.id);
    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    this.identifierToUserId.delete(user.authIdentifier);
    this.users.delete(userId);
  }

  async createRivalry(userId: string, teamLabel: string): Promise<{ rivalry: Rivalry; team: Team }> {
    const user = this.requireUser(userId);
    const rivalry: Rivalry = {
      id: newId(),
      inviteCode: randomCode('RIVAL'),
      roundTarget: 21,
      rulesConvertibleMultiplier: true,
      rulesThingMultiplier: true,
      rulesInteriorMode: false,
      rulesBusEligible: false,
      status: 'pending',
      createdAt: Date.now(),
    };
    const team: Team = {
      id: newId(),
      rivalryId: rivalry.id,
      label: teamLabel,
      colorRole: 'primary',
      inviteCode: randomCode('BUG'),
      createdAt: Date.now(),
    };
    this.rivalries.set(rivalry.id, rivalry);
    this.teams.set(team.id, team);
    this.addMembership(team.id, userId);
    user.activeRivalryId = rivalry.id;
    user.activeTeamId = team.id;
    return { rivalry, team };
  }

  async redeemInviteCode(
    userId: string,
    code: string,
    displayName: string,
  ): Promise<{ rivalry: Rivalry; team: Team } | null> {
    const kind = classifyInviteCode(code);
    if (kind === 'solo') return null;

    const user = this.requireUser(userId);
    user.displayName = displayName || user.displayName;

    if (kind === 'team') {
      const team = [...this.teams.values()].find((t) => t.inviteCode === code.trim().toUpperCase());
      if (!team) throw new Error('That team code was not recognized.');
      this.addMembership(team.id, userId);
      const rivalry = this.rivalries.get(team.rivalryId)!;
      user.activeRivalryId = rivalry.id;
      user.activeTeamId = team.id;
      return { rivalry, team };
    }

    // kind === 'rivalry'
    const rivalry = [...this.rivalries.values()].find(
      (r) => r.inviteCode === code.trim().toUpperCase(),
    );
    if (!rivalry) throw new Error('That rivalry code was not recognized.');

    let secondTeam = [...this.teams.values()].find(
      (t) => t.rivalryId === rivalry.id && t.colorRole === 'secondary',
    );
    if (!secondTeam) {
      secondTeam = {
        id: newId(),
        rivalryId: rivalry.id,
        label: `Team ${displayName.split(' ')[0]}`,
        colorRole: 'secondary',
        inviteCode: randomCode('BUG'),
        createdAt: Date.now(),
      };
      this.teams.set(secondTeam.id, secondTeam);
    }
    this.addMembership(secondTeam.id, userId);
    rivalry.status = 'active';
    this.ensureCurrentRound(rivalry.id);
    user.activeRivalryId = rivalry.id;
    user.activeTeamId = secondTeam.id;
    this.notifyRivalry(rivalry.id);
    return { rivalry, team: secondTeam };
  }

  async startTrip(userId: string, teamId: string | null): Promise<Trip> {
    const trip: Trip = { id: newId(), userId, teamId, startedAt: Date.now(), endedAt: null };
    this.trips.set(trip.id, trip);
    return trip;
  }

  async endTrip(tripId: string): Promise<void> {
    const trip = this.trips.get(tripId);
    if (trip) trip.endedAt = Date.now();
  }

  async logCall(input: LogCallInput): Promise<LogCallResult> {
    const trip = this.trips.get(input.tripId);
    if (!trip) throw new Error('Unknown trip.');
    const user = this.requireUser(input.userId);

    const team = trip.teamId ? this.teams.get(trip.teamId) ?? null : null;
    const rivalry = team ? this.rivalries.get(team.rivalryId) ?? null : null;
    const rules = rivalry ?? DEFAULT_RULES;
    const points = pointsForCall(input.bodyStyle, rules);

    const call: Call = {
      id: newId(),
      tripId: trip.id,
      roundId: rivalry ? this.currentRoundByRivalry.get(rivalry.id) ?? null : null,
      userId: user.id,
      teamId: team?.id ?? null,
      colors: input.colors,
      bodyStyle: input.bodyStyle,
      interiorColors: input.interiorColors ?? [],
      points,
      photoUrl: input.photoUrl ?? null,
      disputed: false,
      createdAt: Date.now(),
    };
    this.calls.set(call.id, call);

    // personal record — always updated, regardless of rivalry membership
    const today = toIsoDate(new Date());
    const streakAfter = extendStreakOnCall(
      { currentStreak: user.currentStreak, longestStreak: user.longestStreak, lastStreakDate: user.lastStreakDate },
      today,
    );
    user.currentStreak = streakAfter.currentStreak;
    user.longestStreak = streakAfter.longestStreak;
    user.lastStreakDate = streakAfter.lastStreakDate;

    const dexResult = recordCallInBugDex(user.bugDex, input.colors, input.bodyStyle);
    user.bugDex = dexResult.dex;
    user.lifetimePoints += points;
    if (call.photoUrl) {
      user.globalWeeklyPoints += points;
      user.globalAnnualPoints += points;
    }

    let roundWinnerTeamId: string | null = null;
    if (team && rivalry) {
      const membership = this.memberships.get(membershipKey(team.id, user.id));
      if (membership) membership.points += points;

      const roundId = this.ensureCurrentRound(rivalry.id);
      const round = this.rounds.get(roundId)!;
      round.teamScores[team.id] = (round.teamScores[team.id] ?? 0) + points;

      roundWinnerTeamId = checkRoundWin(round.teamScores, round.target);
      if (roundWinnerTeamId) {
        round.winnerTeamId = roundWinnerTeamId;
        round.endedAt = Date.now();
        const teamMemberships = [...this.memberships.values()].filter(
          (m) => this.teams.get(m.teamId)?.rivalryId === rivalry.id,
        );
        for (const reset of resetMembershipsForNewRound(teamMemberships)) {
          this.memberships.set(membershipKey(reset.teamId, reset.userId), reset);
        }
        this.startNewRound(rivalry);
      }
      this.notifyRound(roundId);
    }

    return { call, newBugDexFinds: dexResult.newFinds, roundWinnerTeamId };
  }

  async proposeRuling(rivalryId: string, question: string, sourceCallId?: string): Promise<Ruling> {
    const teamIds = [...this.teams.values()]
      .filter((t) => t.rivalryId === rivalryId)
      .map((t) => t.id);
    const votes: Record<string, Vote> = {};
    for (const id of teamIds) votes[id] = null;
    const ruling: Ruling = {
      id: newId(),
      rivalryId,
      question,
      sourceCallId: sourceCallId ?? null,
      votes,
      resolvedVerdict: null,
      resolvedAt: null,
      createdAt: Date.now(),
    };
    this.rulings.set(ruling.id, ruling);
    if (sourceCallId) {
      const call = this.calls.get(sourceCallId);
      if (call) call.disputed = true;
    }
    return ruling;
  }

  async castVote(rulingId: string, teamId: string, vote: Vote): Promise<Ruling> {
    const ruling = this.rulings.get(rulingId);
    if (!ruling) throw new Error('Unknown ruling.');
    ruling.votes[teamId] = vote;

    const teamIds = Object.keys(ruling.votes);
    const [a, b] = teamIds;
    if (a && b) {
      const outcome = resolveRuling(ruling.votes[a] ?? null, ruling.votes[b] ?? null);
      if (outcome.kind !== 'pending') {
        ruling.resolvedVerdict = outcome.verdict;
        ruling.resolvedAt = Date.now();
      }
    }
    return ruling;
  }

  async updateRivalryRules(rivalryId: string, rules: Partial<RivalryRules>): Promise<Rivalry> {
    const rivalry = this.rivalries.get(rivalryId);
    if (!rivalry) throw new Error('Unknown rivalry.');
    Object.assign(rivalry, rules);
    // A rule change (e.g. the round target) applies going forward only — the
    // in-progress round keeps the target it started with, per SPEC.md §4.8.
    this.notifyRivalry(rivalryId);
    return rivalry;
  }

  async getCurrentRound(rivalryId: string): Promise<Round | null> {
    const roundId = this.currentRoundByRivalry.get(rivalryId);
    return roundId ? this.rounds.get(roundId) ?? null : null;
  }

  async getRivalry(rivalryId: string): Promise<Rivalry | null> {
    return this.rivalries.get(rivalryId) ?? null;
  }

  async getTeam(teamId: string): Promise<Team | null> {
    return this.teams.get(teamId) ?? null;
  }

  async getOtherTeam(rivalryId: string, notTeamId: string): Promise<Team | null> {
    return (
      [...this.teams.values()].find((t) => t.rivalryId === rivalryId && t.id !== notTeamId) ?? null
    );
  }

  async getTeamMembers(teamId: string): Promise<Array<TeamMembership & { user: User }>> {
    return [...this.memberships.values()]
      .filter((m) => m.teamId === teamId)
      .map((m) => ({ ...m, user: this.users.get(m.userId)! }))
      .filter((m) => m.user)
      .sort((a, b) => b.points - a.points);
  }

  async listTrips(userId: string): Promise<Trip[]> {
    return [...this.trips.values()]
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  async listCallsForTrip(tripId: string): Promise<Call[]> {
    return [...this.calls.values()]
      .filter((c) => c.tripId === tripId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async listPastRounds(rivalryId: string): Promise<Round[]> {
    return [...this.rounds.values()]
      .filter((r) => r.rivalryId === rivalryId && r.endedAt !== null)
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  }

  async listRulings(rivalryId: string): Promise<Ruling[]> {
    return [...this.rulings.values()]
      .filter((r) => r.rivalryId === rivalryId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getUser(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    // A streak that's been left broken since the last read gets corrected here,
    // so it's accurate the moment the client opens the app — not just at call time.
    const corrected = checkStreakOnOpen(
      { currentStreak: user.currentStreak, longestStreak: user.longestStreak, lastStreakDate: user.lastStreakDate },
      toIsoDate(new Date()),
    );
    user.currentStreak = corrected.currentStreak;
    return user;
  }

  async getRound(roundId: string): Promise<Round | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async getLeaderboard(period: 'weekly' | 'annual'): Promise<LeaderboardEntry[]> {
    const entries: LeaderboardEntry[] = [...this.users.values()]
      .map((u) => ({
        userId: u.id,
        period,
        periodKey: 'current', // period rollover is a Cloud Function concern, not modeled locally
        points: period === 'weekly' ? u.globalWeeklyPoints : u.globalAnnualPoints,
      }))
      .filter((e) => e.points > 0)
      .sort((a, b) => b.points - a.points);
    return entries;
  }

  subscribeToRivalry(rivalryId: string, cb: (r: Rivalry) => void): Unsubscribe {
    if (!this.rivalrySubscribers.has(rivalryId)) this.rivalrySubscribers.set(rivalryId, new Set());
    this.rivalrySubscribers.get(rivalryId)!.add(cb);
    return () => this.rivalrySubscribers.get(rivalryId)?.delete(cb);
  }

  subscribeToRound(roundId: string, cb: (r: Round) => void): Unsubscribe {
    if (!this.roundSubscribers.has(roundId)) this.roundSubscribers.set(roundId, new Set());
    this.roundSubscribers.get(roundId)!.add(cb);
    return () => this.roundSubscribers.get(roundId)?.delete(cb);
  }

  // ---- internals ----

  private requireUser(userId: string): User {
    const user = this.users.get(userId);
    if (!user) throw new Error('Unknown user.');
    return user;
  }

  private addMembership(teamId: string, userId: string): void {
    this.memberships.set(membershipKey(teamId, userId), {
      teamId,
      userId,
      points: 0,
      joinedAt: Date.now(),
    });
  }

  private ensureCurrentRound(rivalryId: string): string {
    const existing = this.currentRoundByRivalry.get(rivalryId);
    if (existing) return existing;
    const rivalry = this.rivalries.get(rivalryId)!;
    return this.startNewRound(rivalry);
  }

  private startNewRound(rivalry: Rivalry): string {
    const teamIds = [...this.teams.values()]
      .filter((t) => t.rivalryId === rivalry.id)
      .map((t) => t.id);
    const teamScores: Record<string, number> = {};
    for (const id of teamIds) teamScores[id] = 0;
    const round: Round = {
      id: newId(),
      rivalryId: rivalry.id,
      teamScores,
      target: rivalry.roundTarget,
      winnerTeamId: null,
      startedAt: Date.now(),
      endedAt: null,
    };
    this.rounds.set(round.id, round);
    this.currentRoundByRivalry.set(rivalry.id, round.id);
    return round.id;
  }

  private notifyRivalry(rivalryId: string): void {
    const rivalry = this.rivalries.get(rivalryId);
    if (!rivalry) return;
    for (const cb of this.rivalrySubscribers.get(rivalryId) ?? []) cb(rivalry);
  }

  private notifyRound(roundId: string): void {
    const round = this.rounds.get(roundId);
    if (!round) return;
    for (const cb of this.roundSubscribers.get(roundId) ?? []) cb(round);
  }
}
