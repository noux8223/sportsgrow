import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBillingExempt, requestPath } from '../src/billing-gate.js';

const athleteId = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const orgId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

test('requestPath strips the query string and hash', () => {
  assert.equal(requestPath('/api/athletes/' + athleteId + '/training?next=/subscription'), '/api/athletes/' + athleteId + '/training');
  assert.equal(requestPath('/api/tickets?status=open#top'), '/api/tickets');
  assert.equal(requestPath('/api/orgs/' + orgId + '/invoices'), '/api/orgs/' + orgId + '/invoices');
});

test('record paths that mention billing routes in the query are not exempt', () => {
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/training?next=/subscription'), false);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/training?next=/invoices'), false);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/training?next=/api/ops/orgs'), false);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/training?next=/api/me/export'), false);
  assert.equal(isBillingExempt('/api/tickets/' + athleteId + '?next=/subscription'), false);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/subscription'), false);
});

test('org subscription and invoice paths are exempt once the query is ignored', () => {
  assert.equal(isBillingExempt('/api/orgs/' + orgId + '/subscription'), true);
  assert.equal(isBillingExempt('/api/orgs/' + orgId + '/subscription?tab=plan'), true);
  assert.equal(isBillingExempt('/api/orgs/' + orgId + '/invoices'), true);
  assert.equal(isBillingExempt('/api/orgs/' + orgId + '/invoices?page=2'), true);
  assert.equal(isBillingExempt('/api/orgs/' + orgId + '/invoices/' + athleteId), false);
});

test('privacy, export, ticket and ops paths stay exempt', () => {
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/erasure'), true);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/erasure?next=/subscription'), true);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/consents'), true);
  assert.equal(isBillingExempt('/api/athletes/' + athleteId + '/consents?purpose=child_account'), true);
  assert.equal(isBillingExempt('/api/me/export'), true);
  assert.equal(isBillingExempt('/api/me/exports/' + athleteId), true);
  assert.equal(isBillingExempt('/api/tickets'), true);
  assert.equal(isBillingExempt('/api/tickets?status=open#top'), true);
  assert.equal(isBillingExempt('/api/ops/invoices?status=open'), true);
  assert.equal(isBillingExempt('/api/ops/orgs/' + orgId + '/subscription'), true);
});
