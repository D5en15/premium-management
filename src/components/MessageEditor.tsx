import { useRef, useState } from 'react';
import { defaultTemplates, reminderVariables, renewalVariables, validTemplates, type MessageTemplates } from '../messages';
import { addMonths, offsetDate, reminder, renewalMessage } from '../domain';

const cards = [
  { key: 'five', title: 'เหลือ 5 วัน', days: 5 },
  { key: 'one', title: 'ก่อนวันหมดอายุ 1 วัน', days: 1 },
  { key: 'today', title: 'วันหมดอายุ', days: 0 },
  { key: 'late', title: 'หลังหมดอายุ 1 วัน', days: -1 },
  { key: 'renewal', title: 'หลังต่ออายุ', days: 0 },
] as const;
export function MessageEditor({ value, serviceName, today, onSave }: { value: MessageTemplates; serviceName: string; today: string; onSave: (next: MessageTemplates) => Promise<boolean> }) {
  const [draft, setDraft] = useState(() => ({ ...value }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputs = useRef<Partial<Record<keyof MessageTemplates, HTMLTextAreaElement | null>>>({});
  const changed = Object.keys(value).some(key => value[key as keyof MessageTemplates] !== draft[key as keyof MessageTemplates]);
  function insert(key: keyof MessageTemplates, variable: string) {
    const input = inputs.current[key];
    const start = input?.selectionStart ?? draft[key].length, end = input?.selectionEnd ?? start;
    const token = `{${variable}}`;
    setDraft({ ...draft, [key]: draft[key].slice(0, start) + token + draft[key].slice(end) });
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); });
  }
  return <form onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    if (!validTemplates(draft)) { setError('กรอกข้อความ 1–2,000 ตัวอักษร และใช้เฉพาะตัวแปรที่แสดงในแต่ละช่อง'); return; }
    setError(''); setBusy(true);
    try { await onSave({ ...draft }); } finally { setBusy(false); }
  }}>
    <p className="subtle-note">แก้ข้อความแล้วกดบันทึก เพื่อใช้กับปุ่มคัดลอกในหน้าแรกและหลังต่ออายุ ตัวอย่างใช้ {serviceName} และต่อ 1 เดือน</p>
    <fieldset disabled={busy} className="message-editor-fields"><div className="templates-grid">{cards.map(card => {
      const variables = card.key === 'renewal' ? renewalVariables : reminderVariables;
      const preview = card.key === 'renewal' ? renewalMessage(serviceName, 1, addMonths(today, 1, Number(today.slice(8))), draft) : reminder(serviceName, card.days, draft, offsetDate(today, card.days));
      return <article className="template-card" key={card.key}><h2>{card.title}</h2><label className="message-editor-label">ข้อความ<textarea aria-label={`ข้อความ ${card.title}`} ref={node => { inputs.current[card.key] = node; }} rows={4} maxLength={2000} value={draft[card.key]} onChange={e => setDraft({ ...draft, [card.key]: e.target.value })} /></label><div className="message-variables">{variables.map(variable => <button type="button" className="button secondary" key={variable} onClick={() => insert(card.key, variable)}>{`{${variable}}`}</button>)}</div><small>ตัวอย่างข้อความ</small><div className="message-preview"><p>{preview || 'กรอกข้อความเพื่อดูตัวอย่าง'}</p></div><button type="button" className="button secondary" onClick={() => setDraft({ ...draft, [card.key]: defaultTemplates[card.key] })}>คืนค่าเริ่มต้น</button></article>;
    })}</div></fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="message-save"><span>{changed ? 'มีข้อความที่ยังไม่ได้บันทึก' : 'กำลังใช้รูปแบบข้อความที่บันทึกไว้'}</span><button className="button primary" disabled={busy || !changed} type="submit">{busy ? 'กำลังบันทึก...' : 'บันทึกรูปแบบข้อความ'}</button></div>
  </form>;
}
