import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, checkStreakOnOpen, extendStreakOnCall, type StreakState } from './streak.js';

test('daysBetween counts calendar days, not hours', () => {
  assert.equal(daysBetween('2026-08-01', '2026-08-02'), 1);
  assert.equal(daysBetween('2026-08-01', '2026-08-08'), 7);
  assert.equal(daysBetween('2026-08-01', '2026-08-01'), 0);
});

test('the first call ever logged starts a 1-day streak', () => {
  const initial: StreakState = { currentStreak: 0, longestStreak: 0, lastStreakDate: null };
  const after = extendStreakOnCall(initial, '2026-08-01');
  assert.equal(after.currentStreak, 1);
  assert.equal(after.longestStreak, 1);
  assert.equal(after.lastStreakDate, '2026-08-01');
});

test('logging a second call the same day does not double-extend', () => {
  const state: StreakState = { currentStreak: 3, longestStreak: 5, lastStreakDate: '2026-08-01' };
  const after = extendStreakOnCall(state, '2026-08-01');
  assert.equal(after.currentStreak, 3);
});

test('logging on the very next day extends the streak', () => {
  const state: StreakState = { currentStreak: 3, longestStreak: 5, lastStreakDate: '2026-08-01' };
  const after = extendStreakOnCall(state, '2026-08-02');
  assert.equal(after.currentStreak, 4);
});

test('a new personal best updates longestStreak', () => {
  const state: StreakState = { currentStreak: 5, longestStreak: 5, lastStreakDate: '2026-08-01' };
  const after = extendStreakOnCall(state, '2026-08-02');
  assert.equal(after.currentStreak, 6);
  assert.equal(after.longestStreak, 6);
});

test('skipping a day resets the streak to 1 on the next call, not 0', () => {
  const state: StreakState = { currentStreak: 9, longestStreak: 9, lastStreakDate: '2026-08-01' };
  const after = extendStreakOnCall(state, '2026-08-05');
  assert.equal(after.currentStreak, 1);
  assert.equal(after.longestStreak, 9, 'personal best is preserved even after the streak breaks');
});

test('opening the app after missing a full day zeroes the streak even with no new call', () => {
  const state: StreakState = { currentStreak: 4, longestStreak: 9, lastStreakDate: '2026-08-01' };
  const checked = checkStreakOnOpen(state, '2026-08-05');
  assert.equal(checked.currentStreak, 0);
});

test('opening the app the day after a call keeps the streak alive, unbroken', () => {
  const state: StreakState = { currentStreak: 4, longestStreak: 9, lastStreakDate: '2026-08-01' };
  const checked = checkStreakOnOpen(state, '2026-08-02');
  assert.equal(checked.currentStreak, 4);
});
