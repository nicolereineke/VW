import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsForCall } from './scoring.js';

const rulesOn = { rulesConvertibleMultiplier: true, rulesThingMultiplier: true };
const rulesOff = { rulesConvertibleMultiplier: false, rulesThingMultiplier: false };

test('a standard Beetle is worth 1 point regardless of house rules', () => {
  assert.equal(pointsForCall('Beetle', rulesOn), 1);
  assert.equal(pointsForCall('Beetle', rulesOff), 1);
});

test('a New Beetle is worth 1 point, same as a classic', () => {
  assert.equal(pointsForCall('New Beetle', rulesOn), 1);
});

test('a Convertible is worth 2 when the rule is on', () => {
  assert.equal(pointsForCall('Convertible', rulesOn), 2);
});

test('a Convertible falls back to 1 when the bonus is toggled off', () => {
  assert.equal(pointsForCall('Convertible', rulesOff), 1);
});

test('a Thing is worth 10 when the rule is on', () => {
  assert.equal(pointsForCall('Thing', rulesOn), 10);
});

test('a Thing falls back to 1 when the bonus is toggled off', () => {
  assert.equal(pointsForCall('Thing', rulesOff), 1);
});
