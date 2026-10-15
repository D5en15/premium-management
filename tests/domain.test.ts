import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTemplates, validTemplates } from '../src/messages.ts';
import { addMonths, daysLeft, exportText, isData, reminder, validDate, type Data } from '../src/domain.ts';

test('renewal keeps the billing day through short months and leap years', () => {
  assert.equal(addMonths('2026-10-03', 1, 3), '2026-11-03');
  assert.equal(addMonths('2026-10-05', 3, 5), '2027-01-05');
  assert.equal(addMonths('2027-01-31', 1, 31), '2027-02-28');
  assert.equal(addMonths('2027-02-28', 1, 31), '2027-03-31');
  assert.equal(addMonths('2028-01-31', 1, 31), '2028-02-29');
  for (const n of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => addMonths('2026-10-03', n, 3));
});
test('only four calendar-day reminder points are eligible', () => {
  for (const n of [-1, 0, 1, 5]) assert.ok(reminder('Demo service', n)?.startsWith('Demo service '));
  for (const n of [-10, -2, 2, 3, 4, 6]) assert.equal(reminder('Demo', n), null);
  assert.equal(daysLeft('2027-01-01', '2026-12-31'), 1);
  assert.equal(daysLeft('2026-10-01', '2026-10-02'), -1);
});
test('export excludes ended subscriptions and private descriptions', () => {
  const data: Data = { version: 1, revision: 'test', members: [{ id: 'm', name: 'คนทดลอง', description: 'private member note' }], services: [{ id: 's', name: 'Demo', symbol: '🟢', color: '#35a877', isActive: false, monthlyPrice: 50, sortOrder: 0 }], subscriptions: [
    { id: '1', memberId: 'm', serviceId: 's', description: 'secret@example.com', expiresOn: '2026-10-05', billingDay: 5, status: 'active' },
    { id: '2', memberId: 'm', serviceId: 's', description: '', expiresOn: '2026-11-05', billingDay: 5, status: 'ended' },
  ] };
  assert.equal(exportText(data), '🟢 Demo 50\nคนทดลอง - 5/10/2026');
  assert.ok(isData(data));
  assert.equal(isData({ ...data, subscriptions: [{ ...data.subscriptions[0], memberId: 'missing' }] }), false);
});
test('reject impossible dates and unsupported saved data', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('2026-13-01'), false);
  assert.equal(isData({ version: 1 }), false);
});

test('custom messages replace allowed variables without recursive replacement', () => {
  const templates = { ...defaultTemplates, five: '{ชื่อแอพ} {จำนวนวันที่เหลือ} วัน วันที่ {วันหมดอายุ}' };
  assert.equal(reminder('Demo', 5, templates, '2026-10-10'), 'Demo 5 วัน วันที่ 10/10/2026');
  assert.equal(reminder('Demo', 2, templates), null);
  assert.equal(validTemplates(templates), true);
  assert.equal(validTemplates({ ...templates, five: '   ' }), false);
  assert.equal(validTemplates({ ...templates, five: '{จำนวนเดือนที่ต่อ}' }), false);
  assert.equal(validTemplates({ ...templates, renewal: '{unknown}' }), false);
});
