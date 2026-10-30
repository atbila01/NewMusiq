import { BILLING_PLANS } from '../../../supabase/functions/_shared/billing-plans.js';

export function membershipForAccount(account, now = Date.now()) {
  const none = { plan: null, plan_name: '', plan_level: 0, browsing: true };
  if (!account || !Object.hasOwn(BILLING_PLANS, account.plan) || !['active', 'trialing'].includes(account.status)) return none;
  const end = account.status === 'trialing' ? account.trial_end || account.period_end : account.period_end;
  if (end && (!Number.isFinite(Date.parse(end)) || Date.parse(end) <= now)) return none;
  return { plan: account.plan, plan_name: BILLING_PLANS[account.plan].name, plan_level: account.plan === 'artist' ? 3 : 2, browsing: false };
}
