import type {
  Call,
  BodyStyle,
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

export interface RivalryRules {
  roundTarget: number;
  rulesConvertibleMultiplier: boolean;
  rulesThingMultiplier: boolean;
  rulesInteriorMode: boolean;
}

export interface LogCallInput {
  tripId: string;
  userId: string;
  colors: string[];
  bodyStyle: BodyStyle;
  interiorColors?: string[];
  photoUrl?: string | null;
}

export interface LogCallResult {
  call: Call;
  newBugDexFinds: string[];
  roundWinnerTeamId: string | null;
}

export type Unsubscribe = () => void;

/**
 * SPEC.md §5. No screen or business-logic module talks to a real backend
 * directly — everything goes through this interface. `LocalBackend`
 * (localBackend.ts) is the only implementation for now; a Firebase adapter
 * gets written once a real project exists, without this interface changing.
 */
export interface BackendService {
  // auth
  requestOtp(identifier: string, method: ContactMethod): Promise<void>;
  verifyOtp(identifier: string, code: string, displayName: string): Promise<User>;
  deleteAccount(userId: string): Promise<void>;

  // rivalry / team
  createRivalry(userId: string, teamLabel: string): Promise<{ rivalry: Rivalry; team: Team }>;
  redeemInviteCode(
    userId: string,
    code: string,
    displayName: string,
  ): Promise<{ rivalry: Rivalry; team: Team } | null>;

  // trips & calls
  startTrip(userId: string, teamId: string | null): Promise<Trip>;
  endTrip(tripId: string): Promise<void>;
  logCall(input: LogCallInput): Promise<LogCallResult>;

  // rulings
  proposeRuling(rivalryId: string, question: string, sourceCallId?: string): Promise<Ruling>;
  castVote(rulingId: string, teamId: string, vote: Vote): Promise<Ruling>;
  updateRivalryRules(rivalryId: string, rules: Partial<RivalryRules>): Promise<Rivalry>;

  // reads
  getUser(userId: string): Promise<User | null>;
  getRound(roundId: string): Promise<Round | null>;
  getCurrentRound(rivalryId: string): Promise<Round | null>;
  getRivalry(rivalryId: string): Promise<Rivalry | null>;
  getTeam(teamId: string): Promise<Team | null>;
  getTeamMembers(teamId: string): Promise<Array<TeamMembership & { user: User }>>;
  getOtherTeam(rivalryId: string, notTeamId: string): Promise<Team | null>;
  listTrips(userId: string): Promise<Trip[]>;
  listCallsForTrip(tripId: string): Promise<Call[]>;
  listPastRounds(rivalryId: string): Promise<Round[]>;
  listRulings(rivalryId: string): Promise<Ruling[]>;
  getLeaderboard(period: 'weekly' | 'annual'): Promise<LeaderboardEntry[]>;

  // realtime
  subscribeToRivalry(rivalryId: string, cb: (r: Rivalry) => void): Unsubscribe;
  subscribeToRound(roundId: string, cb: (r: Round) => void): Unsubscribe;
}
