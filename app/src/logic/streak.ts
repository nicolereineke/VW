// SPEC.md §4.4. Streaks are evaluated against calendar days (ISO yyyy-mm-dd),
// never against app-session state, so they survive a page reload or app restart
// correctly — unlike the prototype's simplified session-only version.

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(earlier: string, later: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseIsoDate(later) - parseIsoDate(earlier)) / msPerDay);
}

/**
 * Call when the app opens. If more than one full day has passed since the
 * streak was last extended, it's broken — reset to 0. A gap of exactly 1 day
 * is still "alive," just not yet extended for today.
 */
export function checkStreakOnOpen(state: StreakState, today: string): StreakState {
  if (!state.lastStreakDate) return state;
  const gap = daysBetween(state.lastStreakDate, today);
  if (gap > 1) {
    return { ...state, currentStreak: 0 };
  }
  return state;
}

/**
 * Call when the user logs a call. Extends the streak at most once per
 * calendar day; logging a second, third, etc. call the same day is a no-op.
 */
export function extendStreakOnCall(state: StreakState, today: string): StreakState {
  if (state.lastStreakDate === today) {
    return state;
  }
  const gap = state.lastStreakDate ? daysBetween(state.lastStreakDate, today) : null;
  const nextStreak = gap === 1 ? state.currentStreak + 1 : 1;
  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(state.longestStreak, nextStreak),
    lastStreakDate: today,
  };
}
