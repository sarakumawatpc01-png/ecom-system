import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStatusTransition, canTransitionStatus } from '../stateMachine';

test('deployment status transitions allow expected states', () => {
  assert.equal(canTransitionStatus('queued', 'running'), true);
  assert.equal(canTransitionStatus('running', 'success'), true);
  assert.equal(canTransitionStatus('success', 'rolled_back'), true);
});

test('deployment status transitions reject invalid paths', () => {
  assert.equal(canTransitionStatus('queued', 'success'), false);
  assert.throws(() => assertStatusTransition('failed', 'running'));
});
