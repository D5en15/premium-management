import { defaultTemplates, type MessageTemplates } from './messages';
import { MessageEditor } from './components/MessageEditor';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDownToLine, ArrowRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Copy, CreditCard, ExternalLink, FlaskConical, LayoutDashboard, LogOut, Menu, MessageSquareText, Pencil, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { bangkokToday, daysLeft, exportText, isData, prettyDate, reminder, sortedSubscriptions, statusText, validDate, type Data, type Member, type Service, type Subscription } from './domain';
import { createMockData, STORAGE_KEY, uid } from './mock';
import { Modal } from './components/Modal';
import { MemberEditor, RenewModal, ServiceEditor } from './components/Editors';
import { emptyData, firebaseError, IS_DEMO, loginWithGoogle, logout, saveMessageTemplates, saveChanges } from './firebase';
import { useFirebase } from './useFirebase';
import { planChanges } from './changes';

type Page = 'dashboard' | 'members' | 'services' | 'templates';
type Dialog = { type: 'renew'; sub: Subscription } | { type: 'member'; member?: Member } | { type: 'detail'; memberId: string } | { type: 'service'; service?: Service } | { type: 'export' } | { type: 'copy'; text: string } | { type: 'demo' } | { type: 'end'; sub: Subscription } | { type: 'deleteMember'; member: Member } | null;
const navigation = [
  { id: 'dashboard' as Page, label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'members' as Page, label: 'สมาชิก', icon: Users },
  { id: 'services' as Page, label: 'บริการพรีเมี่ยม', icon: CreditCard },
  { id: 'templates' as Page, label: 'รูปแบบข้อความ', icon: MessageSquareText },
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const data: unknown = JSON.parse(raw); if (!isData(data)) throw new Error(); return { data, error: '' }; }
    const data = createMockData(); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return { data, error: '' };
  } catch { return { data: createMockData(), error: 'อ่านข้อมูลที่บันทึกไว้ไม่ได้ กำลังใช้ข้อมูลจำลองในหน่วยความจำ เปิดตัวเลือกทดลองเพื่อเริ่มใหม่' }; }
}
function initialPage(): Page { const hash = location.hash.slice(1); return navigation.some(n => n.id === hash) ? hash as Page : 'dashboard'; }
const money = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 2 });

function Brand({ light = false }: { light?: boolean }) { return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><Sparkles size={22} strokeWidth={1.8} /></span><div>premium<span>YOUR FAMILY, ORGANIZED</span></div><span className="brand-dot">.</span></div>; }
function ServiceIcon({ service, small = false }: { service: Service; small?: boolean }) {
  const name = service.name.toLowerCase();
  return <span className={`service-icon ${small ? 'service-icon-small' : ''}`} style={{ '--service-color': service.color } as CSSProperties}>{name.includes('youtube') ? <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true"><rect x="1" y="2" width="22" height="16" rx="5" /><path d="m10 6 6 4-6 4z" fill="white" /></svg> : name.includes('spotify') ? <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M6 8c5-2 10-1 13 1M7 12c4-1.5 8-1 11 1M8 16c3-1 6-.5 9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg> : name.includes('netflix') ? <b className="netflix-mark">N</b> : <b>{service.name.slice(0, 1).toUpperCase()}</b>}</span>;
}
function Avatar({ name, index = 0, large = false }: { name: string; index?: number; large?: boolean }) { return <span className={`avatar avatar-${index % 5} ${large ? 'avatar-large' : ''}`}>{name.slice(0, 1)}</span>; }
function Status({ days }: { days: number }) { return <span className={`status ${days < 0 ? 'overdue' : days === 0 ? 'due' : days <= 5 ? 'soon' : 'normal'}`}><span />{statusText(days)}</span>; }

export default function App() {
  const [initial] = useState(() => IS_DEMO ? load() : { data: emptyData(), error: '' });
  const remote = useFirebase();
  const [demoData, setDemoData] = useState(initial.data);
  const data = IS_DEMO ? demoData : remote.data;
  const setData = IS_DEMO ? setDemoData : remote.setData;
  const [storageError, setStorageError] = useState(initial.error);
  const [page, setPage] = useState<Page>(initialPage);
  const [loggedIn, setLoggedIn] = useState(IS_DEMO && location.hash !== '#login');
  const [mobileNav, setMobileNav] = useState(false);
  const [dialog, setDialogState] = useState<Dialog>(null);
  const [dialogData, setDialogData] = useState(initial.data);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const authenticated = IS_DEMO ? loggedIn : Boolean(remote.user);
  function setDialog(next: Dialog) {
    if (savingRef.current) return;
    if (next && ['renew', 'member', 'service', 'end', 'deleteMember'].includes(next.type)) setDialogData(data);
    setDialogState(next);
  }
  async function signIn() {
    setLoginBusy(true); setLoginError('');
    try { await loginWithGoogle(); } catch (error) { setLoginError(firebaseError(error)); }
    finally { setLoginBusy(false); }
  }
  async function signOut() {
    try {
      if (!IS_DEMO) await logout();
      setLoggedIn(false); setDialog(null); setMobileNav(false); setQuery(''); setServiceFilter('all'); location.hash = 'login';
    } catch (error) { notify(firebaseError(error), true); }
  }
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [tab, setTab] = useState('all');
  const [serviceTab, setServiceTab] = useState('all');
  const [currentDay, setCurrentDay] = useState(bangkokToday);
  const [demoDay, setDemoDay] = useState('');
  const today = demoDay || currentDay;
  useEffect(() => {
    const update = () => setCurrentDay(bangkokToday());
    const timer = setInterval(update, 30_000);
    window.addEventListener('focus', update);
    const hash = () => { if (location.hash === '#login') setLoggedIn(false); else { setPage(initialPage()); if (IS_DEMO) setLoggedIn(true); } };
    window.addEventListener('hashchange', hash);
    const sync = (e: StorageEvent) => { if (IS_DEMO && e.key === STORAGE_KEY && e.newValue) { try { const next: unknown = JSON.parse(e.newValue); if (isData(next)) { setData(next); setStorageError(''); } else setStorageError('ข้อมูลจากอีกแท็บไม่ถูกต้อง กรุณารีเซ็ตข้อมูลจำลอง'); } catch { setStorageError('อ่านข้อมูลจากอีกแท็บไม่ได้'); } } };
    window.addEventListener('storage', sync);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('hashchange', hash); window.removeEventListener('storage', sync); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  function notify(text: string, error = false) { setToast({ text, error }); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4200); }
  async function commit(next: Data, message: string, closeDialog = true, previous = data) {
    if (savingRef.current) return false;
    if (!IS_DEMO) {
      if (remote.loading || remote.error || !remote.user) { notify('ข้อมูลยังไม่พร้อม กรุณาโหลดใหม่ก่อนบันทึก', true); return false; }
      savingRef.current = true; setSaving(true);
      try {
        await saveChanges(previous, next);
        const changes = planChanges(previous, next);
        setData(current => {
          const result = { ...current, revision: uid() };
          for (const name of ['services', 'members', 'subscriptions'] as const) {
            const changed = new Set(changes.filter(c => c.collection === name).map(c => c.id));
            Object.assign(result, { [name]: [...current[name].filter(record => !changed.has(record.id)), ...next[name].filter(record => changed.has(record.id))] });
          }
          return result;
        });
        if (closeDialog) setDialogState(null);
        notify(message); void remote.refresh(); return true;
      } catch (error) { notify(firebaseError(error), true); void remote.refresh(); return false; }
      finally { savingRef.current = false; setSaving(false); }
    }
    const revised = { ...next, revision: uid() };
    try {
      if (!storageError) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const saved: unknown = JSON.parse(raw); if (!isData(saved)) throw new Error('invalid'); if (saved.revision !== data.revision) { setData(saved); notify('ข้อมูลถูกแก้จากอีกแท็บแล้ว กรุณาเปิดรายการใหม่ก่อนบันทึก', true); setDialog(null); return false; } }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(revised)); setStorageError('');
      setData(revised); if (closeDialog) setDialog(null); notify(message); return true;
    } catch {
      setStorageError('บันทึกลงเบราว์เซอร์ไม่ได้ ข้อมูลที่แก้จะอยู่เฉพาะระหว่างเปิดหน้านี้');
      setData(revised); if (closeDialog) setDialog(null); notify(`${message}ในหน่วยความจำ แต่ยังบันทึกถาวรไม่ได้`, true); return true;
    }
  }
  async function saveTemplates(next: MessageTemplates) {
    if (IS_DEMO) return commit({ ...data, messageTemplates: next }, 'บันทึกรูปแบบข้อความแล้ว', false);
    try {
      await saveMessageTemplates(data.messageTemplates ?? defaultTemplates, next);
      setData(current => ({ ...current, messageTemplates: next }));
      notify('บันทึกรูปแบบข้อความแล้ว');
      void remote.refresh(); return true;
    } catch (error) { notify(firebaseError(error), true); return false; }
  }
  function go(next: Page) { setPage(next); location.hash = next; setQuery(''); setServiceFilter(next === 'templates' ? data.services[0]?.id ?? 'all' : 'all'); setMobileNav(false); window.scrollTo({ top: 0 }); }
  async function copy(text: string) {
    try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(text); notify('คัดลอกข้อความแล้ว พร้อมส่งให้สมาชิก'); }
    catch { setDialog({ type: 'copy', text }); notify('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความแล้วคัดลอกได้เลย', true); }
  }
  const sorted = useMemo(() => sortedSubscriptions(data), [data]);
  const due = sorted.filter(s => reminder('', daysLeft(s.expiresOn, today)) !== null);
  const overdue = sorted.filter(s => daysLeft(s.expiresOn, today) < 0);
  const monthly = sorted.reduce((sum, s) => sum + (data.services.find(v => v.id === s.serviceId)?.monthlyPrice ?? 0), 0);
  const memberById = (id: string) => data.members.find(m => m.id === id)!;
  const serviceById = (id: string) => data.services.find(s => s.id === id)!;
  const filtered = sorted.filter(s => (serviceFilter === 'all' || s.serviceId === serviceFilter) && memberById(s.memberId).name.toLowerCase().includes(query.toLowerCase()) && (tab === 'all' || tab === 'remind' && due.some(d => d.id === s.id) || tab === 'overdue' && daysLeft(s.expiresOn, today) < 0));
  const filteredMembers = data.members.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) && (serviceFilter === 'all' || data.subscriptions.some(s => s.memberId === m.id && s.serviceId === serviceFilter && s.status === 'active')));
  const selectedMember = dialog?.type === 'detail' ? memberById(dialog.memberId) : null;

  function subscriptionRow(sub: Subscription, index: number) {
    const member = memberById(sub.memberId), service = serviceById(sub.serviceId), days = daysLeft(sub.expiresOn, today), text = reminder(service.name, days, data.messageTemplates, sub.expiresOn);
    return <div className="subscription-row" key={sub.id}>
      <button className="member-cell" onClick={() => setDialog({ type: 'detail', memberId: member.id })}><Avatar name={member.name} index={data.members.indexOf(member)} /><span><strong>{member.name}</strong><small>{data.subscriptions.filter(s => s.memberId === member.id && s.status === 'active').length > 1 ? 'สมาชิกหลายบริการ' : 'สมาชิก Family'}</small></span></button>
      <div className="service-cell"><ServiceIcon service={service} small /><span>{service.name}<small>฿{money(service.monthlyPrice)} / เดือน</small></span></div>
      <div className="expiry-cell"><span>{prettyDate(sub.expiresOn)}</span><Status days={days} /></div>
      <div className="row-actions">{text && <button className="button copy-button" aria-label={`คัดลอกข้อความ ${member.name} ${service.name}`} onClick={() => void copy(text)}><Copy size={15} /><span>คัดลอกข้อความ</span></button>}<button className="button renew-button" aria-label={`ต่ออายุ ${member.name} ${service.name}`} onClick={() => setDialog({ type: 'renew', sub })}><Plus size={15} /><span>ต่ออายุ</span></button></div>
      <span className="sr-only">รายการที่ {index + 1}</span>
    </div>;
  }
  function searchBar() { return <div className="filter-bar"><label className="search"><Search size={18} /><input placeholder="ค้นหาชื่อสมาชิก..." aria-label="ค้นหาสมาชิก" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="ล้างการค้นหา"><X size={15} /></button>}</label><label className="filter-select"><Settings2 size={16} /><select aria-label="กรองบริการ" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}><option value="all">ทุกบริการ</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={14} /></label><span className="sort-note"><CalendarDays size={15} /> {page === 'dashboard' ? 'เรียงตามวันหมดอายุ' : `${filteredMembers.length} สมาชิก`}</span></div>; }

  if (!IS_DEMO && !remote.authReady) return <ConnectionState title="กำลังตรวจสอบบัญชี" />;
  if (!IS_DEMO && authenticated && (remote.loading || remote.error)) return <ConnectionState title={remote.loading ? 'กำลังโหลดข้อมูลสมาชิก' : 'โหลดข้อมูลไม่สำเร็จ'} error={remote.error} onRetry={() => void remote.refresh()} onLogout={() => void signOut()} />;

  return <>
    {!authenticated ? <div className="login-page"><section className="login-story"><Brand light /><div className="login-story-content"><span className="eyebrow light">LESS ADMIN. MORE TIME.</span><h1>ทุกสมาชิก<br />ดูแลง่ายขึ้น<span>.</span></h1><p>จัดการบริการพรีเมี่ยม ต่ออายุ และเตือนกำหนดจ่าย<br />ให้เรื่องเล็ก ๆ ไม่ต้องกินเวลาของคุณ</p><div className="login-illustration"><div className="illustration-card"><span className="mini-label">FAMILY OVERVIEW</span><div className="illustration-avatars">{['พ', 'ธ', 'ณ', 'ก'].map((name, i) => <Avatar key={i} name={name} index={i} />)}<span className="avatar">+8</span></div><div className="illustration-line"><CheckCheck size={18} /> ทุกอย่างพร้อมดูแล</div></div><div className="illustration-badge"><Check size={17} /> ต่ออายุเรียบร้อย</div></div></div><small>พื้นที่เล็ก ๆ สำหรับดูแล Family ของคุณ</small></section><section className="login-form"><span className="demo-pill"><ShieldCheck size={14} /> {IS_DEMO ? 'FRONTEND PREVIEW' : 'PRIVATE FAMILY SPACE'}</span><div className="login-form-content"><span className="login-icon"><ShieldCheck size={28} /></span><h2>ยินดีต้อนรับกลับมา</h2><p>พื้นที่จัดการบริการพรีเมี่ยมของคุณ</p><button className="button google-button" disabled={IS_DEMO || loginBusy} onClick={() => void signIn()}><span className="google-g">G</span> {loginBusy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</button><p className="form-hint centered">{IS_DEMO ? 'กำลังใช้ข้อมูลจำลองสำหรับตรวจ UI' : 'สำหรับบัญชี nonteerapong8@gmail.com เท่านั้น'}</p>{(loginError || remote.authError) && <p className="form-error" role="alert">{loginError || remote.authError}</p>}{IS_DEMO && <><div className="or-divider"><span>สำหรับตรวจหน้าเว็บ</span></div><button className="button primary login-demo" onClick={() => { setLoggedIn(true); go('dashboard'); }}>เข้าสู่โหมดทดลอง <ArrowRight size={18} /></button><div className="login-note"><FlaskConical size={17} /><span>ใช้ข้อมูลสมมติทั้งหมด<br /><small>ทดลองได้โดยไม่ต้องใช้บัญชี Google</small></span></div></>}</div><small className="login-footer">Premium Management · Made for your everyday</small></section></div> : <div className="app-shell">
      {mobileNav && <button className="nav-scrim" aria-label="ปิดเมนู" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Brand /><button className="icon-button mobile-close" aria-label="ปิดเมนู" onClick={() => setMobileNav(false)}><X size={20} /></button></div><div className="workspace-label">พื้นที่จัดการของคุณ</div><nav aria-label="เมนูหลัก">{navigation.map(n => <button key={n.id} aria-label={n.label} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => go(n.id)}><n.icon size={19} strokeWidth={1.7} /><span>{n.label}</span>{n.id === 'dashboard' && due.length > 0 && <b>{due.length}</b>}</button>)}</nav><div className="sidebar-bottom">{!IS_DEMO && <button className="nav-item" onClick={() => void remote.refresh()}><RotateCcw size={18} /><span>โหลดข้อมูลล่าสุด</span></button>}{IS_DEMO && <button className="nav-item" onClick={() => setDialog({ type: 'demo' })}><FlaskConical size={18} /><span>ตัวเลือกโหมดทดลอง</span></button>}<div className="owner-profile"><span className="owner-avatar">N</span><span><strong>เจ้าของ Family</strong><small>{IS_DEMO ? 'บัญชีทดลอง' : 'บัญชีเจ้าของ · Google'}</small></span><button className="icon-button" aria-label="ออกจากระบบ / ดูหน้าเข้าสู่ระบบ" onClick={() => void signOut()}><LogOut size={17} /></button></div></div></aside>
      <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button menu-toggle" onClick={() => setMobileNav(true)} aria-label="เปิดเมนู"><Menu size={22} /></button><span>พื้นที่จัดการ</span><ChevronRight size={14} /><strong>{navigation.find(n => n.id === page)?.label}</strong></div><div className="topbar-right"><span className="top-avatar">N</span></div></header>
      <main>
        {storageError && <div className="storage-warning" role="alert">{storageError}<button onClick={() => setDialog({ type: 'demo' })}>ตัวเลือกทดลอง</button></div>}
        <div className="page-heading"><div><span className="eyebrow">{page === 'dashboard' ? 'YOUR FAMILY AT A GLANCE' : page === 'members' ? 'THE PEOPLE IN YOUR FAMILY' : page === 'services' ? 'YOUR PREMIUM COLLECTION' : 'A LITTLE REMINDER GOES A LONG WAY'}</span><h1>{page === 'dashboard' ? 'ภาพรวมของคุณ' : page === 'members' ? 'สมาชิกใน Family' : page === 'services' ? 'บริการพรีเมี่ยม' : 'รูปแบบข้อความ'}<span className="heading-dot">.</span></h1><p>{page === 'dashboard' ? 'ทุกกำหนดจ่าย ทุกสมาชิก ดูแลได้ในที่เดียว' : page === 'members' ? 'จัดการข้อมูลสมาชิกและทุกบริการที่ใช้งาน' : page === 'services' ? 'จัดการแพ็กเกจ ราคา และบริการที่คุณเปิดให้ใช้งาน' : 'ปรับข้อความเตือนและข้อความหลังต่ออายุในแบบของคุณ'}</p></div><div className="heading-actions">{page === 'dashboard' ? <button className="button secondary" onClick={() => setDialog({ type: 'export' })}><ArrowDownToLine size={17} />คัดลอกข้อมูลทั้งหมด</button> : page === 'templates' ? <span className="page-date"><CalendarDays size={17} />{prettyDate(today, true)}</span> : null}{page !== 'templates' && <button className="button primary" onClick={() => setDialog(page === 'services' ? { type: 'service' } : { type: 'member' })}><Plus size={18} />{page === 'services' ? 'เพิ่มบริการ' : 'เพิ่มสมาชิก'}</button>}</div></div>

        {page === 'dashboard' && <>
          <section className="stats-grid" aria-label="สรุปข้อมูล"><article className="stat-card"><div><span>สมาชิกทั้งหมด</span><Users size={19} /></div><strong>{data.members.length}<small>คน</small></strong><p><span className="stat-dot" /> อยู่ใน Family ของคุณ</p></article><article className="stat-card"><div><span>บริการที่เปิดอยู่</span><CreditCard size={19} /></div><strong>{data.services.filter(s => s.isActive).length}<small>บริการ</small></strong><p>{sorted.length} รายการที่ใช้งาน</p></article><article className="stat-card stat-highlight"><div><span>ต้องแจ้งเตือนวันนี้</span><Bell size={19} /></div><strong>{due.length}<small>รายการ</small></strong><button onClick={() => setTab('remind')}>ดูรายการที่ต้องเตือน <ArrowRight size={14} /></button></article><article className="stat-card"><div><span>มูลค่าบริการต่อเดือน</span><span className="baht-icon">฿</span></div><strong><span className="currency">฿</span>{money(monthly)}</strong><p>ตามรายการที่ใช้งาน · ไม่ใช่ยอดรับชำระ</p></article></section>
          <section className="reminder-banner"><span className="banner-icon"><Bell size={21} /></span><div><strong>{due.length ? `มี ${due.length} รายการที่ถึงช่วงแจ้งเตือนวันนี้` : 'วันนี้ยังไม่มีรายการที่ต้องแจ้งเตือน'}</strong><p>เหลือ 5 วัน · ก่อนครบกำหนด 1 วัน · วันครบกำหนด · เลยกำหนด 1 วัน</p></div><button onClick={() => setTab('remind')}>ดูรายการ <ArrowRight size={17} /></button></section>
          <section className="list-panel"><div className="panel-heading"><div><h2>กำหนดจ่ายของสมาชิก <span>{sorted.length}</span></h2><p>เรียงจากรายการที่ครบกำหนดก่อน</p></div><span className="page-date"><CalendarDays size={16} />{prettyDate(today, true)}</span></div><div className="tabs" role="tablist" aria-label="กรองกำหนดจ่าย">{[{ id: 'all', label: 'ทั้งหมด', count: sorted.length }, { id: 'remind', label: 'ต้องเตือนวันนี้', count: due.length }, { id: 'overdue', label: 'เลยกำหนด', count: overdue.length }].map(t => <button role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'selected' : ''} key={t.id} onClick={() => setTab(t.id)}>{t.label}<span>{t.count}</span></button>)}</div>{searchBar()}<div className="table-heading"><span>สมาชิก</span><span>บริการ</span><span>วันหมดอายุ / สถานะ</span><span>จัดการ</span></div><div className="subscription-list">{filtered.map(subscriptionRow)}{!filtered.length && <Empty title="ไม่พบรายการ" text="ลองเปลี่ยนตัวกรองหรือค้นหาชื่ออื่น" onClear={() => { setQuery(''); setServiceFilter('all'); setTab('all'); }} />}</div><div className="panel-footer"><span>แสดง {filtered.length} จาก {sorted.length} รายการ</span><span><ShieldCheck size={14} /> {IS_DEMO ? 'ข้อมูลจำลองสำหรับทดลองใช้งาน' : 'ข้อมูลส่วนตัว · บัญชีเจ้าของเท่านั้น'}</span></div></section>
        </>}

        {page === 'members' && <><div className="members-summary"><span className="summary-icon"><Users size={22} /></span><div><strong>{data.members.length} สมาชิก</strong><span> · {sorted.length} รายการบริการที่ใช้งาน</span></div><p>หนึ่งสมาชิก จัดการได้หลายบริการ</p></div><section className="list-panel member-panel">{searchBar()}<div className="member-grid">{filteredMembers.map((member, index) => { const subs = data.subscriptions.filter(s => s.memberId === member.id && s.status === 'active'); const closest = [...subs].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0]; return <button className="member-card" key={member.id} onClick={() => setDialog({ type: 'detail', memberId: member.id })}><div className="member-card-top"><Avatar name={member.name} index={index} large /><ChevronRight size={18} /></div><h3>{member.name}</h3><div className="service-chips">{subs.map(s => <span key={s.id} style={{ '--service-color': serviceById(s.serviceId).color } as CSSProperties}><i />{serviceById(s.serviceId).name}</span>)}{!subs.length && <span>ไม่มีบริการที่ใช้งาน</span>}</div><div className="member-card-bottom"><span>กำหนดจ่ายถัดไป</span>{closest ? <strong>{prettyDate(closest.expiresOn)}</strong> : <strong>—</strong>}</div></button>; })}</div>{!filteredMembers.length && <Empty title="ไม่พบสมาชิก" text="ลองค้นหาชื่ออื่น หรือเพิ่มสมาชิกคนแรกของคุณ" onClear={() => { setQuery(''); setServiceFilter('all'); }} />}</section></>}

        {page === 'services' && <><div className="service-page-tools"><div className="segmented">{[{ id: 'all', label: 'ทุกบริการ' }, { id: 'active', label: 'เปิดให้บริการ' }, { id: 'inactive', label: 'ปิดให้บริการ' }].map(t => <button key={t.id} className={serviceTab === t.id ? 'selected' : ''} onClick={() => setServiceTab(t.id)}>{t.label}</button>)}</div><span>{data.services.length} บริการทั้งหมด</span></div><div className="services-grid">{data.services.filter(s => serviceTab === 'all' || s.isActive === (serviceTab === 'active')).map(service => { const subs = sorted.filter(s => s.serviceId === service.id); return <article className={`service-card ${!service.isActive ? 'inactive-service' : ''}`} key={service.id}><div className="service-card-top"><ServiceIcon service={service} /><span className={`availability ${service.isActive ? 'available' : ''}`}><i />{service.isActive ? 'เปิดให้บริการ' : 'ปิดให้บริการ'}</span></div><h2>{service.name}</h2><div className="service-price">฿{money(service.monthlyPrice)}<span>/ เดือน</span></div><div className="service-card-info"><span><Users size={16} /> สมาชิกที่ใช้งาน</span><strong>{subs.length} คน</strong></div><div className="service-card-footer"><button className="button secondary" onClick={() => setDialog({ type: 'service', service })}><Pencil size={15} />แก้ไขบริการ</button><button role="switch" aria-checked={service.isActive} aria-label={`${service.isActive ? 'ปิด' : 'เปิด'}บริการ ${service.name}`} disabled={saving} className={`toggle ${service.isActive ? 'on' : ''}`} onClick={() => commit({ ...data, services: data.services.map(s => s.id === service.id ? { ...s, isActive: !s.isActive } : s) }, service.isActive ? 'ปิดบริการแล้ว ข้อมูลสมาชิกเดิมยังคงอยู่' : 'เปิดให้บริการแล้ว')}><span /></button></div></article>; })}<button className="add-service-card" onClick={() => setDialog({ type: 'service' })}><span><Plus size={26} /></span><strong>เพิ่มบริการใหม่</strong><p>ให้ Family ของคุณมีตัวเลือกมากขึ้น</p></button></div><div className="subtle-note"><CircleHelp size={17} /><p>การปิดบริการจะเก็บข้อมูลสมาชิกเดิมไว้ และซ่อนบริการจากตัวเลือกสมัครใหม่</p></div></>}

        {page === 'templates' && <MessageEditor key={JSON.stringify(data.messageTemplates ?? defaultTemplates)} value={data.messageTemplates ?? defaultTemplates} serviceName={data.services[0]?.name ?? 'YouTube'} today={today} onSave={saveTemplates} />}
        <footer className="main-footer"><span>premium<span className="green">.</span> <span className="footer-tagline">A little less work, a little more time.</span></span><span>{IS_DEMO ? 'โหมดทดลอง · ไม่แก้ข้อมูลจริง' : 'บันทึกข้อมูลบน Firebase'}</span></footer>
      </main></div>
    </div>}

    {authenticated && dialog?.type === 'renew' && <RenewModal sub={dialog.sub} data={dialogData} onClose={() => setDialog(null)} onCopy={text => void copy(text)} onSave={async date => { const current = data.subscriptions.find(s => s.id === dialog.sub.id); if (!current || current.expiresOn !== dialog.sub.expiresOn || current.status !== 'active') { notify('รายการนี้เปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนต่ออายุ', true); setDialog(null); return false; } return commit({ ...dialogData, subscriptions: dialogData.subscriptions.map(s => s.id === current.id ? { ...s, expiresOn: date } : s) }, 'ต่ออายุสมาชิกเรียบร้อยแล้ว', false, dialogData); }} />}
    {authenticated && dialog?.type === 'service' && <ServiceEditor service={dialog.service} order={data.services.length} onClose={() => setDialog(null)} onSave={service => commit({ ...dialogData, services: dialogData.services.some(s => s.id === service.id) ? dialogData.services.map(s => s.id === service.id ? service : s) : [...dialogData.services, service] }, 'บันทึกบริการเรียบร้อยแล้ว', true, dialogData)} />}
    {authenticated && dialog?.type === 'member' && <MemberEditor member={dialog.member} data={dialogData} today={today} onClose={() => setDialog(null)} onSave={(member, subs) => commit({ ...dialogData, members: dialogData.members.some(m => m.id === member.id) ? dialogData.members.map(m => m.id === member.id ? member : m) : [...dialogData.members, member], subscriptions: [...dialogData.subscriptions.filter(s => s.memberId !== member.id), ...subs] }, 'บันทึกสมาชิกเรียบร้อยแล้ว', true, dialogData)} />}
    {authenticated && dialog?.type === 'detail' && selectedMember && <Modal title="รายละเอียดสมาชิก" onClose={() => setDialog(null)} wide><div className="detail-body"><div className="detail-profile"><Avatar name={selectedMember.name} large index={data.members.indexOf(selectedMember)} /><div><h2>{selectedMember.name}</h2></div><button className="button secondary" onClick={() => setDialog({ type: 'member', member: selectedMember })}><Pencil size={15} />แก้ไข</button></div><div className="section-heading"><h3>บริการของสมาชิก</h3><button className="text-button" onClick={() => setDialog({ type: 'member', member: selectedMember })}><Plus size={16} />เพิ่มบริการ</button></div>{data.subscriptions.filter(s => s.memberId === selectedMember.id).map(sub => { const service = serviceById(sub.serviceId); return <article className={`detail-sub ${sub.status === 'ended' ? 'ended-sub' : ''}`} key={sub.id}><div className="detail-sub-heading"><ServiceIcon service={service} small /><div><strong>{service.name}</strong><small>฿{money(service.monthlyPrice)} / เดือน</small></div>{sub.status === 'active' ? <Status days={daysLeft(sub.expiresOn, today)} /> : <span className="ended-label">ยุติแล้ว</span>}</div><dl><div><dt>วันหมดอายุ</dt><dd>{prettyDate(sub.expiresOn, true)}</dd></div><div><dt>บัญชี / โปรไฟล์</dt><dd>{sub.description || 'ไม่ได้ระบุ'}</dd></div></dl><div className="detail-sub-actions"><button className="text-button danger" onClick={() => setDialog({ type: 'end', sub })}>ลบบริการของสมาชิก</button>{sub.status === 'active' && <button className="button renew-button" onClick={() => setDialog({ type: 'renew', sub })}><Plus size={15} />ต่ออายุ</button>}</div></article>; })}{!data.subscriptions.some(s => s.memberId === selectedMember.id) && <div className="empty-inline">ยังไม่มีบริการ เพิ่มบริการเพื่อกำหนดวันหมดอายุ</div>}<footer className="modal-actions"><button className="button danger-solid" onClick={() => setDialog({ type: 'deleteMember', member: selectedMember })}>ลบสมาชิก</button></footer></div></Modal>}
    {authenticated && dialog?.type === 'deleteMember' && <Modal title="ลบสมาชิกถาวร?" subtitle={dialog.member.name} onClose={() => setDialog(null)}><div className="form-body"><p>ลบสมาชิกและบริการทั้งหมดของสมาชิกคนนี้ ({dialogData.subscriptions.filter(s => s.memberId === dialog.member.id).length} รายการ) รวมวันหมดอายุและข้อมูลบัญชีออกถาวร จะกู้คืนจากเว็บไม่ได้</p><footer className="modal-actions"><button className="button secondary" disabled={saving} onClick={() => setDialog(null)}>ยกเลิก</button><button className="button danger-solid" disabled={saving} onClick={() => commit({ ...dialogData, members: dialogData.members.filter(m => m.id !== dialog.member.id), subscriptions: dialogData.subscriptions.filter(s => s.memberId !== dialog.member.id) }, 'ลบสมาชิกและบริการทั้งหมดแล้ว', true, dialogData)}>ยืนยันลบสมาชิก</button></footer></div></Modal>}
    {authenticated && dialog?.type === 'end' && <Modal title="ลบบริการของสมาชิก?" subtitle={`${memberById(dialog.sub.memberId).name} · ${serviceById(dialog.sub.serviceId).name}`} onClose={() => setDialog(null)}><div className="form-body"><p>ลบบริการนี้ของสมาชิกออกถาวร รวมวันหมดอายุและข้อมูลบัญชี จะกู้คืนจากเว็บไม่ได้ บริการอื่นและชื่อสมาชิกยังอยู่</p><footer className="modal-actions"><button className="button secondary" onClick={() => setDialog(null)}>ยกเลิก</button><button className="button danger-solid" disabled={saving} onClick={() => commit({ ...dialogData, subscriptions: dialogData.subscriptions.filter(s => s.id !== dialog.sub.id) }, 'ลบบริการของสมาชิกแล้ว', true, dialogData)}>ลบถาวร</button></footer></div></Modal>}
    {authenticated && (dialog?.type === 'export' || dialog?.type === 'copy') && <Modal title={dialog.type === 'export' ? 'คัดลอกข้อมูลทั้งหมด' : 'คัดลอกข้อความ'} subtitle={dialog.type === 'export' ? 'รายชื่อและวันหมดอายุ แยกตามบริการ พร้อมเก็บไว้ในมือถือ' : 'เลือกข้อความด้านล่างแล้วคัดลอกด้วยตัวเองได้เลย'} onClose={() => setDialog(null)} wide><div className="form-body"><textarea className="export-text" aria-label="ข้อความสำหรับคัดลอก" rows={14} readOnly value={dialog.type === 'export' ? exportText(data) : dialog.text} onFocus={e => e.target.select()} /><p className="form-hint">{dialog.type === 'export' ? 'รวมรายการที่ยังไม่ยุติ ไม่มีคำอธิบายบัญชีปะปน' : 'แตะค้างหรือใช้ Ctrl / ⌘ + C เพื่อคัดลอก'}</p><footer className="modal-actions"><button className="button secondary" onClick={() => setDialog(null)}>ปิด</button><button className="button primary" onClick={() => void copy(dialog.type === 'export' ? exportText(data) : dialog.text)}><Copy size={17} />คัดลอกข้อความ</button></footer></div></Modal>}
    {IS_DEMO && dialog?.type === 'demo' && <Modal title="ตัวเลือกโหมดทดลอง" subtitle="ใช้ข้อมูลสมมติ แยกจากข้อมูลสมาชิกจริงทั้งหมด" onClose={() => setDialog(null)}><div className="form-body"><label>วันที่สำหรับทดลองกำหนดจ่าย<input type="date" min="1000-01-01" max="9999-12-31" value={today} onChange={e => { if (validDate(e.target.value)) setDemoDay(e.target.value); }} /></label><p className="form-hint">เปลี่ยนวันที่เพื่อดูสถานะและข้อความเตือน โดยไม่แก้วันหมดอายุสมาชิก</p><button className="text-button" onClick={() => setDemoDay('')}><CalendarDays size={16} />ใช้วันที่ปัจจุบันในประเทศไทย</button><div className="demo-reset"><strong>เริ่มทดลองใหม่</strong><p>แทนที่ข้อมูลทดลองที่คุณแก้ไขด้วยชุดใหม่ โดยให้มีครบทั้ง 4 ช่วงแจ้งเตือนตามวันที่ที่เลือก</p><button className="button secondary" onClick={() => { commit(createMockData(today), 'เริ่มข้อมูลจำลองชุดใหม่แล้ว'); setQuery(''); setTab('all'); setServiceFilter('all'); }}><RotateCcw size={16} />รีเซ็ตข้อมูลจำลอง</button></div><button className="button secondary" onClick={() => { setDialog(null); setLoggedIn(false); location.hash = 'login'; }}><ExternalLink size={16} />ดูหน้าเข้าสู่ระบบ</button><p className="form-hint">การแก้ข้อมูลเก็บไว้ในเบราว์เซอร์นี้ วันที่ทดลองจะกลับเป็นวันนี้เมื่อรีเฟรช</p></div></Modal>}
    {saving && <div className="save-indicator" role="status"><RotateCcw size={16} />กำลังบันทึก...</div>}
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status">{toast.error ? <CircleHelp size={19} /> : <Check size={19} />}<span>{toast.text}</span><button aria-label="ปิดข้อความแจ้งผล" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </>;
}

function Empty({ title, text, onClear }: { title: string; text: string; onClear: () => void }) { return <div className="empty-state"><span><Search size={26} /></span><h3>{title}</h3><p>{text}</p><button className="button secondary" onClick={onClear}>ล้างตัวกรอง</button></div>; }

function ConnectionState({ title, error, onRetry, onLogout }: { title: string; error?: string; onRetry?: () => void; onLogout?: () => void }) {
  return <div className="connection-state"><Brand /><div><ShieldCheck size={32} /><h1>{title}</h1>{error ? <p role="alert">{error}</p> : <p>กรุณารอสักครู่</p>}{error && onRetry && <button className="button primary" onClick={onRetry}>ลองโหลดใหม่</button>}{onLogout && <button className="button secondary" onClick={onLogout}>ออกจากระบบ</button>}</div></div>;
}
