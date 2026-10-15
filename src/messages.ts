export const defaultTemplates = {
  five: '{ชื่อแอพ} อีก {จำนวนวันที่เหลือ} วันกำหนดจ่ายนะครับผม',
  one: '{ชื่อแอพ} วันพรุ่งนี้กำหนดจ่ายนะครับ',
  today: '{ชื่อแอพ} วันนี้กำหนดจ่ายนะครับ',
  late: '{ชื่อแอพ} วันนี้กำหนดจ่ายวันสุดท้ายนะครับ หากเกินวันนี้เวลา 2 ทุ่ม ผมขออนุญาตนำออกนะครับผม',
  renewal: '{ชื่อแอพ} ต่ออายุ {จำนวนเดือนที่ต่อ} เดือนเรียบร้อยแล้วนะครับ กำหนดจ่ายครั้งถัดไปวันที่ {กำหนดจ่ายครั้งถัดไป} ครับผม',
};
export type MessageTemplates = typeof defaultTemplates;
export const reminderKeys: Record<number, keyof MessageTemplates> = { 5: 'five', 1: 'one', 0: 'today', [-1]: 'late' };
export const reminderVariables = ['ชื่อแอพ', 'จำนวนวันที่เหลือ', 'วันหมดอายุ'];
export const renewalVariables = ['ชื่อแอพ', 'จำนวนเดือนที่ต่อ', 'กำหนดจ่ายครั้งถัดไป'];
export function renderMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([^{}]+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
export function validTemplates(value: unknown): value is MessageTemplates {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(defaultTemplates).every(key => {
    const text = (value as Record<string, unknown>)[key];
    const allowed = key === 'renewal' ? renewalVariables : reminderVariables;
    return typeof text === 'string' && text.trim().length > 0 && text.length <= 2000 && [...text.matchAll(/\{([^{}]*)\}/g)].every(match => allowed.includes(match[1])) && !text.replace(/\{[^{}]*\}/g, '').match(/[{}]/);
  });
}
