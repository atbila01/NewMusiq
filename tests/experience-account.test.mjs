import test from 'node:test';
import assert from 'node:assert/strict';
import { membershipForAccount } from '../src/experience/lib/account-model.js';

const now = Date.parse('2026-10-30T02:00:00Z');
test('existing listener and artist subscriptions retain NewMusiq entitlements', () => {
  assert.equal(membershipForAccount({plan:'listener',status:'active'},now).plan_level,2);
  assert.equal(membershipForAccount({plan:'artist',status:'active'},now).plan_level,3);
});
test('Emergent plan names and unpaid states cannot grant access', () => {
  for (const plan of ['standard','pro','admin',null]) assert.equal(membershipForAccount({plan,status:'active'},now).plan_level,0);
  for (const status of ['past_due','unpaid','incomplete','canceled']) assert.equal(membershipForAccount({plan:'artist',status},now).plan_level,0);
});
test('expired or invalid trial and subscription periods do not grant access', () => {
  for (const end of ['2026-10-29T00:00:00Z','not-a-date']) {
    assert.equal(membershipForAccount({plan:'artist',status:'trialing',trial_end:end},now).plan_level,0);
    assert.equal(membershipForAccount({plan:'listener',status:'active',period_end:end},now).plan_level,0);
  }
  assert.equal(membershipForAccount({plan:'listener',status:'trialing',trial_end:'2026-11-30T00:00:00Z'},now).plan_level,2);
});

test('complimentary server entitlement unlocks all membership tiers without a paid plan', () => {
  const access = membershipForAccount({plan:'artist',status:'canceled'},now,{complimentary:true});
  assert.equal(access.plan_level,3);
  assert.equal(access.browsing,false);
  assert.equal(access.plan,null);
  assert.equal(access.complimentary,true);
  assert.equal(membershipForAccount({complimentary:true,role:'admin'},now).plan_level,0);
  assert.equal(membershipForAccount(null,now,{complimentary:'true'}).plan_level,0);
});
