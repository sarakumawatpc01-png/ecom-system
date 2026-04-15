import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedDomain, normalizeDomain, validateDomainFormat } from '../domainValidation';

test('domain validator accepts valid FQDN', () => {
  assert.equal(validateDomainFormat('store.example.com'), true);
  assert.equal(normalizeDomain('  EXAMPLE.COM  '), 'example.com');
});

test('domain validator rejects invalid domain', () => {
  assert.equal(validateDomainFormat('localhost'), false);
  assert.equal(validateDomainFormat('bad domain.com'), false);
});

test('allowlist enforces suffix matching', () => {
  assert.equal(isAuthorizedDomain('store.example.com', ['example.com']), true);
  assert.equal(isAuthorizedDomain('store.unauthorized.com', ['example.com']), false);
});
