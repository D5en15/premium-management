import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Copy, Plus, Trash2 } from 'lucide-react';
import { addMonths, prettyDate, renewalMessage, validDate, type Data, type Member, type Service, type Subscription } from '../domain';
import { uid } from '../mock';
import { Modal } from './Modal';

export function RenewModal({ sub, data, onClose, onSave, onCopy }: { sub: Subscription; data: Data; onClose: () => void; onSave: (date: string) => Promise<boolean>; onCopy: (text: string) => void }) {
  const [months, setMonths] = useState('1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ months: number; date: string } | null>(null);
  let next = '';
  try { if (!/^\d+$/.test(months)) throw new Error(); next = addMonths(sub.expiresOn, Number(months), sub.billingDay); } catch { /* Invalid input has no date preview. */ }
  const service = data.services.find(s => s.id === sub.serviceId)!;
  const member = data.members.find(m => m.id === sub.memberId)!;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!next) { setError('กรุณากรอกจำนวนเดือนเป็นจำนวนเต็มมากกว่า 0 และไม่เกินปี 9999'); return; }
    setBusy(true);
    if (await onSave(next)) setSaved({ months: Number(months), date: next });
    else setBusy(false);
  }
  if (saved) {
    const message = renewalMessage(service.name, saved.months, saved.date, data.messageTemplates);
    return <Modal title="ต่ออายุเรียบร้อยแล้ว" subtitle={`${member.name} · ${service.name}`} onClose={onClose}>
      <div className="form-body">
        <div className="date-preview"><div><span>ต่ออายุ</span><strong>{saved.months} เดือน</strong></div><ArrowRight size={20} /><div><span>กำหนดจ่ายครั้งถัดไป</span><strong className="green">{prettyDate(saved.date)}</strong></div></div>
        <label>ข้อความแจ้งต่ออายุ<textarea rows={3} readOnly value={message} onFocus={e => e.target.select()} /></label>
        <p className="form-hint">คัดลอกข้อความนี้เพื่อแจ้งสมาชิกได้เลย</p>
        <footer className="modal-actions"><button className="button secondary" onClick={onClose}>ปิด</button><button className="button primary" onClick={() => onCopy(message)}><Copy size={17} />คัดลอกข้อความต่ออายุ</button></footer>
      </div>
    </Modal>;
  }
  return <Modal title="ต่ออายุสมาชิก" subtitle={`${member.name} · ${service.name}`} onClose={onClose}>
    <form onSubmit={submit} className="form-body"><fieldset disabled={busy}>
      <label>จำนวนเดือนที่ต่ออายุ<div className="input-unit"><input autoFocus type="number" inputMode="numeric" min="1" step="1" required value={months} onChange={e => { setMonths(e.target.value); setError(''); }} /><span>เดือน</span></div></label>
      <div className="date-preview"><div><span>วันหมดอายุเดิม</span><strong>{prettyDate(sub.expiresOn)}</strong></div><ArrowRight size={20} /><div><span>วันหมดอายุใหม่</span><strong className="green">{next ? prettyDate(next) : '—'}</strong></div></div>
      <p className="form-hint"><CalendarDays size={16} /> ต่อจากวันหมดอายุเดิม และรักษาวันประจำรอบวันที่ {sub.billingDay}</p>
      {next && <label style={{ marginTop: 18 }}>ตัวอย่างข้อความหลังบันทึก<textarea rows={3} readOnly value={renewalMessage(service.name, Number(months), next, data.messageTemplates)} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button><button className="button primary" disabled={busy}><Check size={17} /> บันทึกการต่ออายุ</button></footer>
    </fieldset></form>
  </Modal>;
}

export function ServiceEditor({ service, order, onClose, onSave }: { service?: Service; order: number; onClose: () => void; onSave: (value: Service) => Promise<boolean> }) {
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(String(service?.monthlyPrice ?? ''));
  const [color, setColor] = useState(service?.color ?? '#419db2');
  const [symbol, setSymbol] = useState(service?.symbol ?? '🔵');
  const [active, setActive] = useState(service?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) { setError('กรุณากรอกชื่อบริการและราคาที่ไม่ติดลบ'); return; }
    setBusy(true);
    await onSave({ id: service?.id ?? uid(), name: name.trim(), monthlyPrice: Number(price), color, symbol, isActive: active, sortOrder: service?.sortOrder ?? order });
    setBusy(false);
  }
  return <Modal title={service ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'} subtitle="ตั้งค่าบริการพรีเมี่ยมของคุณ" onClose={onClose}><form onSubmit={submit} className="form-body"><fieldset disabled={busy}>
    <label>ชื่อบริการ<input autoFocus required maxLength={80} placeholder="เช่น YouTube Premium" value={name} onChange={e => setName(e.target.value)} /></label>
    <label>ราคาต่อเดือน<div className="input-unit"><input required type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} /><span>บาท / เดือน</span></div></label>
    <div className="form-grid"><label>สัญลักษณ์<select value={symbol} onChange={e => setSymbol(e.target.value)}>{['🔴', '🟢', '🟣', '🔵', '🟠', '🟡', '⚫'].map(s => <option key={s}>{s}</option>)}</select></label><label>สีบริการ<input aria-label="สีบริการ" type="color" value={color} onChange={e => setColor(e.target.value)} /></label></div>
    <label className="check-label"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /><span>เปิดให้บริการ<small>เมื่อปิด สมาชิกเดิมและข้อมูลยังคงอยู่</small></span></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button><button className="button primary"><Check size={17} /> บันทึกบริการ</button></footer>
  </fieldset></form></Modal>;
}

type DraftSub = Subscription;
export function MemberEditor({ member, data, today, onClose, onSave }: { member?: Member; data: Data; today: string; onClose: () => void; onSave: (member: Member, subs: Subscription[]) => Promise<boolean> }) {
  const [memberId] = useState(member?.id ?? uid());
  const [name, setName] = useState(member?.name ?? '');
  const original = data.subscriptions.filter(s => s.memberId === member?.id);
  const [subs, setSubs] = useState<DraftSub[]>(original.map(s => ({ ...s })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const duplicate = data.members.some(m => m.id !== memberId && m.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  function addSub() {
    const service = data.services.find(s => s.isActive && !subs.some(x => x.serviceId === s.id && x.status === 'active'));
    if (!service) { setError('ไม่มีบริการที่เปิดให้เพิ่มแล้ว กรุณาเพิ่มหรือเปิดบริการในหน้าบริการ'); return; }
    setError('');
    setSubs([...subs, { id: uid(), memberId, serviceId: service.id, description: '', expiresOn: today, billingDay: Number(today.slice(-2)), status: 'active' }]);
  }
  function update(id: string, patch: Partial<Subscription>) { setSubs(subs.map(s => s.id === id ? { ...s, ...patch } : s)); }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('กรุณากรอกชื่อสมาชิก'); return; }
    if (subs.some(s => !validDate(s.expiresOn))) { setError('กรุณากรอกวันหมดอายุที่ถูกต้อง'); return; }
    const active = subs.filter(s => s.status === 'active');
    if (new Set(active.map(s => s.serviceId)).size !== active.length) { setError('สมาชิกมีบริการนี้ที่ใช้งานอยู่แล้ว กรุณาเลือกบริการอื่น'); return; }
    setBusy(true);
    await onSave({ id: memberId, name: name.trim(), description: member?.description ?? '' }, subs.map(s => ({ ...s, description: s.description.trim() })));
    setBusy(false);
  }
  return <Modal title={member ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิกใหม่'} subtitle="ข้อมูลติดต่อและบริการ จัดการได้ในที่เดียว" onClose={onClose} wide><form onSubmit={submit} className="form-body"><fieldset disabled={busy}>
    <label>ชื่อสมาชิก <span className="muted">(ชื่อ Facebook)</span><input autoFocus required maxLength={120} placeholder="ชื่อที่ใช้ติดต่อสมาชิก" value={name} onChange={e => setName(e.target.value)} /></label>
    {duplicate && <p className="inline-warning">มีสมาชิกชื่อนี้อยู่แล้ว หากเป็นคนเดิมให้แก้ไขสมาชิกเดิม หากเป็นคนละคนสามารถบันทึกต่อได้</p>}
    <div className="section-heading"><h3>บริการของสมาชิก</h3><button type="button" className="text-button" onClick={addSub}><Plus size={16} /> เพิ่มบริการ</button></div>
    {!subs.length && <div className="empty-inline">ยังไม่มีบริการ กด “เพิ่มบริการ” เพื่อกำหนดวันหมดอายุ</div>}
    {subs.map((s, index) => <section className="subscription-editor" key={s.id}>
      <div className="section-heading"><span className="small-label">บริการที่ {index + 1}{s.status === 'ended' ? ' · ยุติแล้ว' : ''}</span>{!original.some(x => x.id === s.id) && <button type="button" className="icon-button" aria-label={`ลบบริการที่ ${index + 1}`} onClick={() => setSubs(subs.filter(x => x.id !== s.id))}><Trash2 size={16} /></button>}</div>
      <div className="form-grid"><label>บริการ<select value={s.serviceId} onChange={e => update(s.id, { serviceId: e.target.value })}>{data.services.filter(v => v.isActive || v.id === s.serviceId).map(v => <option key={v.id} value={v.id}>{v.name}{!v.isActive ? ' (ปิดบริการ)' : ''}</option>)}</select></label><label>วันหมดอายุ<input required type="date" min="1000-01-01" max="9999-12-31" value={s.expiresOn} onChange={e => update(s.id, { expiresOn: e.target.value, billingDay: Number(e.target.value.slice(-2)) })} /></label></div>
      <label>บัญชี / อีเมล / โปรไฟล์<textarea rows={2} maxLength={1000} placeholder="ข้อมูลบัญชีของบริการนี้ (ไม่บังคับ)" value={s.description} onChange={e => update(s.id, { description: e.target.value })} /></label>
    </section>)}
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>ยกเลิก</button><button className="button primary"><Check size={17} /> บันทึกสมาชิก</button></footer>
  </fieldset></form></Modal>;
}
