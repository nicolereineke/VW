// Shared types for the whole app. Kept dependency-free (no DOM, no backend SDK)
// so the logic layer in src/logic/ never needs to know how it's rendered or persisted.

export type BodyStyle = 'Beetle' | 'Convertible' | 'New Beetle' | 'Thing';

export type ContactMethod = 'email' | 'phone';

export interface User {
  id: string;
  displayName: string;
  authMethod: ContactMethod;
  authIdentifier: string;
  createdAt: number;
  lifetimePoints: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null; // ISO date (yyyy-mm-dd), local calendar day
  bugDex: Set<string>; // "{color}|{bodyStyle}"
  globalWeeklyPoints: number;
  globalAnnualPoints: number;
  activeRivalryId: string | null;
  activeTeamId: string | null;
}

export type TeamColorRole = 'primary' | 'secondary';

export interface Team {
  id: string;
  rivalryId: string;
  label: string;
  colorRole: TeamColorRole;
  inviteCode: string;
  createdAt: number;
}

export interface TeamMembership {
  userId: string;
  teamId: string;
  points: number;
  joinedAt: number;
}

export type RivalryStatus = 'pending' | 'active';

export interface Rivalry {
  id: string;
  inviteCode: string;
  roundTarget: number;
  rulesConvertibleMultiplier: boolean;
  rulesThingMultiplier: boolean;
  rulesInteriorMode: boolean;
  rulesBusEligible: false;
  status: RivalryStatus;
  createdAt: number;
}

export interface Round {
  id: string;
  rivalryId: string;
  teamScores: Record<string, number>;
  target: number;
  winnerTeamId: string | null;
  startedAt: number;
  endedAt: number | null;
}

export interface Trip {
  id: string;
  userId: string;
  teamId: string | null;
  startedAt: number;
  endedAt: number | null;
}

export interface Call {
  id: string;
  tripId: string;
  roundId: string | null;
  userId: string;
  teamId: string | null;
  colors: string[];
  bodyStyle: BodyStyle;
  interiorColors: string[];
  points: number;
  photoUrl: string | null;
  disputed: boolean;
  createdAt: number;
}

export type Vote = 'yes' | 'no' | null;

export interface Ruling {
  id: string;
  rivalryId: string;
  question: string;
  sourceCallId: string | null;
  votes: Record<string, Vote>;
  resolvedVerdict: string | null;
  resolvedAt: number | null;
  createdAt: number;
}

export interface LeaderboardEntry {
  userId: string;
  period: 'weekly' | 'annual';
  periodKey: string;
  points: number;
}
