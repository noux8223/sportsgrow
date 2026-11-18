const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const ATHLETE_PRIVACY = new RegExp(`^/api/athletes/${UUID}/(?:erasure|consents)$`, 'i');
const ORG_BILLING = new RegExp(`^/api/orgs/${UUID}/(?:subscription|invoices)$`, 'i');

export function requestPath(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

export function isBillingExempt(url: string): boolean {
  const path = requestPath(url);
  if (path.startsWith('/api/ops/')) return true;
  if (path.startsWith('/api/me/export')) return true;
  if (path === '/api/tickets') return true;
  if (ATHLETE_PRIVACY.test(path)) return true;
  if (ORG_BILLING.test(path)) return true;
  return false;
}
