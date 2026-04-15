import test from 'node:test';
import assert from 'node:assert/strict';
import { withBackoff } from '../backoff';
import { assertStatusTransition } from '../stateMachine';

test('integration: SSL step retries then succeeds', async () => {
  let attempts = 0;
  const result = await withBackoff(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('transient ssl failure');
      return 'ok';
    },
    { retries: 3, baseDelayMs: 1, retryable: () => true }
  );
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('integration: nginx config generation failure remains failed before rollback transition', async () => {
  await assert.rejects(
    withBackoff(
      async () => {
        throw new Error('nginx generation failed');
      },
      { retries: 1, baseDelayMs: 1, retryable: () => false }
    )
  );
  assert.doesNotThrow(() => assertStatusTransition('running', 'failed'));
  assert.doesNotThrow(() => assertStatusTransition('failed', 'rolled_back'));
});
