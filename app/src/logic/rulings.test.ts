import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuling } from './rulings.js';

test('stays pending until both teams have voted', () => {
  assert.equal(resolveRuling(null, null).kind, 'pending');
  assert.equal(resolveRuling('yes', null).kind, 'pending');
  assert.equal(resolveRuling(null, 'no').kind, 'pending');
});

test('both yes confirms the call', () => {
  const outcome = resolveRuling('yes', 'yes');
  assert.equal(outcome.kind, 'confirmed');
});

test('both no rejects the call', () => {
  const outcome = resolveRuling('no', 'no');
  assert.equal(outcome.kind, 'rejected');
});

test('a disagreement resolves as a split decision, not a stuck state', () => {
  const a = resolveRuling('yes', 'no');
  const b = resolveRuling('no', 'yes');
  assert.equal(a.kind, 'split');
  assert.equal(b.kind, 'split');
  assert.ok(a.kind === 'split');
  assert.match(a.verdict, /no consensus/i);
});
