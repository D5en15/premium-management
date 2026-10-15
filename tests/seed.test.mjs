import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInitialData, planImport } from '../scripts/seed-data.mjs';

const text = '```text\n🟢 Music 50\nคนจำลอง - 31/1/2027\n🔴 Video 75\nคนจำลอง - 5/2/2027\nอีกคน - 6/2/2027\n```';
const empty = { services: [], members: [], subscriptions: [] };
test('shared members keep independent subscription dates and deterministic IDs', () => {
  const seed = parseInitialData(text);
  assert.equal(seed.services.length, 2);
  assert.equal(seed.members.length, 2);
  assert.equal(seed.subscriptions.length, 3);
  assert.equal(seed.subscriptions[0].expiresOn, '2027-01-31');
  assert.equal(seed.subscriptions[0].billingDay, 31);
  assert.equal(seed.subscriptions[0].memberId, seed.subscriptions[1].memberId);
  assert.deepEqual(parseInitialData(text), seed);
});
test('reimport adds nothing and preserves renewed dates and private descriptions', () => {
  const seed = parseInitialData(text);
  assert.equal(planImport(seed, empty).create.length, 7);
  const existing = structuredClone(seed);
  existing.subscriptions[0].expiresOn = '2027-12-31';
  existing.members[0].description = 'keep this note';
  const plan = planImport(seed, existing);
  assert.equal(plan.create.length, 0);
  assert.equal(plan.skipped, 7);
  assert.equal(plan.resolved.subscriptions[0].expiresOn, '2027-12-31');
  assert.equal(plan.resolved.members[0].description, 'keep this note');
});
test('existing natural keys are reused and impossible dates are rejected', () => {
  const seed = parseInitialData(text);
  const existing = { ...empty, members: [{ id: 'already-there', name: 'คนจำลอง', description: 'note' }] };
  const plan = planImport(seed, existing);
  assert.equal(plan.resolved.subscriptions[0].memberId, 'already-there');
  assert.equal(plan.create.filter(d => d.collection === 'members').length, 1);
  assert.throws(() => parseInitialData(text.replace('31/1/2027', '31/2/2027')));
  assert.throws(() => planImport(seed, { ...existing, members: [...existing.members, { ...existing.members[0], id: 'duplicate' }] }));
});
