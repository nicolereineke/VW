import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInviteCode, isValidInviteCodeFormat } from './invite.js';

test('no code, empty string, or whitespace-only all classify as solo', () => {
  assert.equal(classifyInviteCode(undefined), 'solo');
  assert.equal(classifyInviteCode(null), 'solo');
  assert.equal(classifyInviteCode(''), 'solo');
  assert.equal(classifyInviteCode('   '), 'solo');
});

test('a RIVAL- prefixed code classifies as joining a rivalry, case-insensitively', () => {
  assert.equal(classifyInviteCode('RIVAL-K92M'), 'rivalry');
  assert.equal(classifyInviteCode('rival-k92m'), 'rivalry');
});

test('any other non-empty code classifies as joining a team', () => {
  assert.equal(classifyInviteCode('BUG-7X2Q'), 'team');
  assert.equal(classifyInviteCode('anything-else'), 'team');
});

test('valid code format requires two dash-separated alphanumeric groups', () => {
  assert.ok(isValidInviteCodeFormat('BUG-7X2Q'));
  assert.ok(isValidInviteCodeFormat('RIVAL-K92M'));
  assert.ok(!isValidInviteCodeFormat('nocode'));
  assert.ok(!isValidInviteCodeFormat(''));
});
