import test from 'node:test';
import assert from 'node:assert/strict';
import { planChanges, sameRecord } from '../src/changes.ts';
import type { Data } from '../src/domain.ts';

const data: Data = { version: 1, revision: 'original', services: [{ id: 'service', name: 'Music', monthlyPrice: 50, symbol: '🟢', color: '#35a877', isActive: true, sortOrder: 0 }], members: [{ id: 'member', name: 'คนจำลอง', description: '' }], subscriptions: [{ id: 'sub', memberId: 'member', serviceId: 'service', description: 'profile', expiresOn: '2026-10-05', billingDay: 5, status: 'active' }] };
test('renewal writes only its subscription and excludes IDs and timestamps', () => {
  const next = structuredClone(data);
  next.subscriptions[0].expiresOn = '2026-11-05';
  const changes = planChanges(data, next);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].collection, 'subscriptions');
  assert.equal(changes[0].value.expiresOn, '2026-11-05');
  assert.equal(changes[0].value.billingDay, 5);
  assert.equal('id' in changes[0].value, false);
  assert.equal('createdAt' in changes[0].value, false);
  assert.equal(sameRecord('subscriptions', next.subscriptions[0], data.subscriptions[0]), false);
});
test('one member with multiple services becomes one atomic set of changes', () => {
  const next = structuredClone(data);
  next.members.push({ id: 'new-member', name: 'ใหม่', description: '' });
  next.subscriptions.push({ ...data.subscriptions[0], id: 'new-sub', memberId: 'new-member' });
  const changes = planChanges(data, next);
  assert.deepEqual(changes.map(c => c.collection), ['members', 'subscriptions']);
  assert.ok(changes.every(c => c.before === null));
  assert.equal(changes[1].value.memberId, 'new-member');
});
test('member cascade deletes only related documents; broken references are rejected', () => {
  assert.equal(planChanges(data, structuredClone(data)).length, 0);
  const removed = planChanges(data, { ...data, subscriptions: [] });
  assert.equal(removed.length, 1);
  assert.equal(removed[0].delete, true);
  assert.equal(removed[0].collection, 'subscriptions');
  assert.equal(removed[0].id, 'sub');
  const cascade = planChanges(data, { ...data, subscriptions: [], members: [] });
  assert.deepEqual(cascade.map(c => [c.collection, c.id, c.delete]), [['members', 'member', true], ['subscriptions', 'sub', true]]);
  assert.throws(() => planChanges(data, { ...data, subscriptions: [], services: [] }), /Cannot delete/);
  assert.throws(() => planChanges(data, { ...data, members: [] }), /ข้อมูลไม่ถูกต้อง/);
  assert.ok(sameRecord('members', data.members[0], { ...data.members[0], createdAt: 'ignored', updatedAt: 'ignored' }));
});
