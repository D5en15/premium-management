import { createHash } from 'node:crypto';

const stableId = (prefix, value) => `${prefix}-${createHash('sha256').update(value.normalize('NFC')).digest('hex').slice(0, 20)}`;
const colors = { '🔴': '#ed5b53', '🟢': '#35a877', '🟣': '#a176cb', '🔵': '#419db2' };

// Parse only the source text block. The Markdown summary is not input data.
export function parseInitialData(markdown) {
  const text = markdown.match(/```text\s*\n([\s\S]*?)```/)?.[1];
  if (!text) throw new Error('ไม่พบข้อมูลต้นฉบับใน text block');
  const services = [], members = [], subscriptions = [];
  const names = new Map();
  const pairs = new Set();
  let service;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const row = line.match(/^(.+) - (\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!row) {
      const header = line.match(/^(\S+) (.+) (\d+(?:\.\d+)?)$/u);
      if (!header) throw new Error('พบรูปแบบข้อมูลที่ไม่รองรับ');
      const [, symbol, name, price] = header;
      if (services.some(s => s.name === name)) throw new Error('ชื่อบริการซ้ำในต้นฉบับ');
      service = { id: stableId('service', name), name, monthlyPrice: Number(price), symbol, color: colors[symbol] ?? '#419db2', isActive: true, sortOrder: services.length };
      services.push(service);
      continue;
    }
    if (!service) throw new Error('ข้อมูลสมาชิกไม่มีหัวกลุ่มบริการ');
    const [, name, day, month, year] = row;
    const expiresOn = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(`${expiresOn}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== expiresOn) throw new Error('วันที่ในต้นฉบับไม่ถูกต้อง');
    const key = name.normalize('NFC');
    let member = names.get(key);
    if (!member) { member = { id: stableId('member', key), name, description: '' }; names.set(key, member); members.push(member); }
    const pair = `${member.id}/${service.id}`;
    if (pairs.has(pair)) throw new Error('สมาชิกและบริการซ้ำในต้นฉบับ');
    pairs.add(pair);
    subscriptions.push({ id: stableId('subscription', pair), memberId: member.id, serviceId: service.id, description: '', expiresOn, billingDay: Number(day), status: 'active' });
  }
  if (!services.length || !members.length || !subscriptions.length) throw new Error('ข้อมูลต้นฉบับไม่ครบ');
  return { services, members, subscriptions };
}

// Existing records, including renewals and account notes, are never overwritten.
export function planImport(seed, existing) {
  const create = [];
  const resolved = { services: [], members: [], subscriptions: [] };
  const maps = { services: new Map(), members: new Map() };
  for (const collection of ['services', 'members']) {
    for (const item of seed[collection]) {
      const matches = existing[collection].filter(x => x.name?.normalize('NFC') === item.name.normalize('NFC'));
      if (matches.length > 1) throw new Error(`มีชื่อซ้ำใน ${collection} ต้องตรวจข้อมูลก่อนนำเข้า`);
      const byId = existing[collection].find(x => x.id === item.id);
      if (byId && byId.name?.normalize('NFC') !== item.name.normalize('NFC')) throw new Error(`ID ขัดแย้งใน ${collection}`);
      const found = byId ?? matches[0];
      const value = found ?? item;
      maps[collection].set(item.id, value.id);
      resolved[collection].push(value);
      if (!found) create.push({ collection, ...item });
    }
  }
  for (const source of seed.subscriptions) {
    const item = { ...source, memberId: maps.members.get(source.memberId), serviceId: maps.services.get(source.serviceId) };
    const matches = existing.subscriptions.filter(x => x.memberId === item.memberId && x.serviceId === item.serviceId);
    if (matches.length > 1) throw new Error('มีหลายรายการต่อสมาชิกและบริการ ต้องตรวจข้อมูลก่อนนำเข้า');
    const byId = existing.subscriptions.find(x => x.id === item.id);
    if (byId && (byId.memberId !== item.memberId || byId.serviceId !== item.serviceId)) throw new Error('ID รายการบริการขัดแย้ง');
    const found = byId ?? matches[0];
    resolved.subscriptions.push(found ?? item);
    if (!found) create.push({ collection: 'subscriptions', ...item });
  }
  return { create, resolved, skipped: seed.services.length + seed.members.length + seed.subscriptions.length - create.length };
}
