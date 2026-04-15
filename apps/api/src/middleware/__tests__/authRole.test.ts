import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../auth';

const createRes = () => {
  const payload: { code?: number; body?: unknown } = {};
  return {
    payload,
    status(code: number) {
      payload.code = code;
      return this;
    },
    json(body: unknown) {
      payload.body = body;
      return this;
    }
  };
};

test('requireRole allows super_admin', () => {
  const middleware = requireRole('super_admin');
  const req = { ctx: { user: { role: 'super_admin' } } };
  const res = createRes();
  let nextCalled = false;
  middleware(req as any, res as any, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('requireRole blocks non-super-admin users', () => {
  const middleware = requireRole('super_admin');
  const req = { ctx: { user: { role: 'viewer' } } };
  const res = createRes();
  middleware(req as any, res as any, () => undefined);
  assert.equal(res.payload.code, 403);
});
