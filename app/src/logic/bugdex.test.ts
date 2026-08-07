import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordCallInBugDex, bugDexKey } from './bugdex.js';
import { BUG_DEX_SIZE } from './colors.js';

test('a brand new combination is reported as a new find', () => {
  const result = recordCallInBugDex(new Set(), ['Kasan Red'], 'Thing');
  assert.deepEqual(result.newFinds, ['Kasan Red|Thing']);
  assert.ok(result.dex.has('Kasan Red|Thing'));
});

test('logging an already-found combination again reports no new finds', () => {
  const dex = new Set([bugDexKey('Kasan Red', 'Thing')]);
  const result = recordCallInBugDex(dex, ['Kasan Red'], 'Thing');
  assert.deepEqual(result.newFinds, []);
});

test('a multi-color call can produce multiple new finds at once', () => {
  const result = recordCallInBugDex(new Set(), ['Kasan Red', 'Olympic Blue'], 'Convertible');
  assert.equal(result.newFinds.length, 2);
});

test('a multi-color call only reports the combinations that are actually new', () => {
  const dex = new Set([bugDexKey('Kasan Red', 'Convertible')]);
  const result = recordCallInBugDex(dex, ['Kasan Red', 'Olympic Blue'], 'Convertible');
  assert.deepEqual(result.newFinds, ['Olympic Blue|Convertible']);
});

test('completion is measured against the full 56-combination Dex', () => {
  const result = recordCallInBugDex(new Set(), ['Kasan Red'], 'Thing');
  assert.equal(BUG_DEX_SIZE, 56);
  assert.equal(result.completion, 1 / 56);
});
