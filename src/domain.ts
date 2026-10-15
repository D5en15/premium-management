import { defaultTemplates, reminderKeys, renderMessage, validTemplates, type MessageTemplates } from './messages.ts';
export type Service = { id: string; name: string; monthlyPrice: number; symbol: string; color: string; isActive: boolean; sortOrder: number };
export type Member = { id: string; name: string; description: string };
export type Subscription = { id: string; memberId: string; serviceId: string; description: string; expiresOn: string; billingDay: number; status: 'active' | 'ended' };
export type Data = { version: 1; revision: string; messageTemplates?: MessageTemplates; services: Service[]; members: Member[]; subscriptions: Subscription[] };

export function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 1000;
}
export function daysLeft(expiresOn: string, today: string) {
  return Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
export function offsetDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
export function addMonths(date: string, months: number, billingDay: number) {
  if (!validDate(date) || !Number.isSafeInteger(months) || months < 1 || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) throw new Error('กรุณากรอกจำนวนเดือนเป็นจำนวนเต็มมากกว่า 0');
  const [year, month] = date.split('-').map(Number);
  const total = year * 12 + month - 1 + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total % 12;
  if (targetYear > 9999) throw new Error('จำนวนเดือนมากเกินไป กรุณาลดจำนวนเดือน');
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(billingDay, lastDay)).padStart(2, '0')}`;
}
export function shortDate(date: string) { const [y, m, d] = date.split('-').map(Number); return `${d}/${m}/${y}`; }
export function renewalMessage(serviceName: string, months: number, nextDate: string, templates = defaultTemplates) {
  return renderMessage(templates.renewal, { ชื่อแอพ: serviceName, จำนวนเดือนที่ต่อ: months, กำหนดจ่ายครั้งถัดไป: shortDate(nextDate) });
}
export function prettyDate(date: string, full = false) {
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: full ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
export function statusText(days: number) { return days < 0 ? `เลยกำหนด ${Math.abs(days)} วัน` : days === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${days} วัน`; }
export function reminder(name: string, days: number, templates = defaultTemplates, expiresOn = ''): string | null {
  const key = reminderKeys[days];
  return key ? renderMessage(templates[key], { ชื่อแอพ: name, จำนวนวันที่เหลือ: days, วันหมดอายุ: expiresOn ? shortDate(expiresOn) : '' }) : null;
}
export function sortedSubscriptions(data: Data) {
  return data.subscriptions.filter(s => s.status === 'active').sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || (data.members.find(m => m.id === a.memberId)?.name ?? '').localeCompare(data.members.find(m => m.id === b.memberId)?.name ?? '', 'th'));
}
export function exportText(data: Data) {
  const sorted = sortedSubscriptions(data);
  return [...data.services].sort((a, b) => a.sortOrder - b.sortOrder).flatMap(service => {
    const subs = sorted.filter(s => s.serviceId === service.id);
    if (!subs.length) return [];
    return [`${service.symbol} ${service.name} ${service.monthlyPrice}\n${subs.map(s => `${data.members.find(m => m.id === s.memberId)!.name} - ${shortDate(s.expiresOn)}`).join('\n')}`];
  }).join('\n\n');
}
export function isData(value: unknown): value is Data {
  if (!value || typeof value !== 'object') return false;
  const d = value as Data;
  if (d.messageTemplates !== undefined && !validTemplates(d.messageTemplates)) return false;
  if (d.version !== 1 || typeof d.revision !== 'string' || !Array.isArray(d.services) || !Array.isArray(d.members) || !Array.isArray(d.subscriptions)) return false;
  const unique = (items: { id: string }[]) => items.every(x => typeof x.id === 'string') && new Set(items.map(x => x.id)).size === items.length;
  if (!d.services.every(s => s && typeof s.name === 'string' && typeof s.symbol === 'string' && /^#[\da-f]{6}$/i.test(s.color) && Number.isFinite(s.monthlyPrice) && s.monthlyPrice >= 0 && typeof s.isActive === 'boolean' && Number.isFinite(s.sortOrder))) return false;
  if (!d.members.every(m => m && typeof m.name === 'string' && typeof m.description === 'string')) return false;
  if (!d.subscriptions.every(s => s && typeof s.description === 'string' && typeof s.expiresOn === 'string' && validDate(s.expiresOn) && Number.isInteger(s.billingDay) && s.billingDay >= 1 && s.billingDay <= 31 && ['active', 'ended'].includes(s.status) && d.services.some(x => x.id === s.serviceId) && d.members.some(x => x.id === s.memberId))) return false;
  return unique(d.services) && unique(d.members) && unique(d.subscriptions);
}
