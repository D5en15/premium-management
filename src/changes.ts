import { isData, type Data } from './domain.ts';

export const fields = {
  services: ['name', 'monthlyPrice', 'symbol', 'color', 'isActive', 'sortOrder'],
  members: ['name', 'description'],
  subscriptions: ['memberId', 'serviceId', 'description', 'expiresOn', 'billingDay', 'status'],
} as const;
export type CollectionName = keyof typeof fields;
export function recordFields(collection: CollectionName, record: object) {
  return Object.fromEntries(fields[collection].map(key => [key, (record as Record<string, unknown>)[key]]));
}
export function sameRecord(collection: CollectionName, a: object, b: object) {
  return JSON.stringify(recordFields(collection, a)) === JSON.stringify(recordFields(collection, b));
}
export function planChanges(previous: Data, next: Data) {
  if (!isData(next)) throw new Error('ข้อมูลไม่ถูกต้อง กรุณาตรวจข้อมูลก่อนบันทึก');
  const changes: { collection: CollectionName; id: string; before: object | null; value: Record<string, unknown>; delete?: boolean }[] = [];
  for (const collection of Object.keys(fields) as CollectionName[]) {
    const removed = previous[collection].filter(old => !next[collection].some(record => record.id === old.id));
    if (removed.length && collection === 'services') throw new Error('Cannot delete service definitions');
    for (const before of removed) changes.push({ collection, id: before.id, before, value: {}, delete: true });
    for (const record of next[collection]) {
      const before = previous[collection].find(old => old.id === record.id);
      if (!before || !sameRecord(collection, before, record)) changes.push({ collection, id: record.id, before: before ?? null, value: recordFields(collection, record) });
    }
  }
  return changes;
}
