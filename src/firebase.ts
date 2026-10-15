import { defaultTemplates, validTemplates, type MessageTemplates } from './messages';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, getDocsFromServer, getDocFromServer, getFirestore, runTransaction, serverTimestamp, query, where } from 'firebase/firestore';
import config from './firebase-config.json';
import { isData, type Data } from './domain';
import { fields, planChanges, recordFields, sameRecord, type CollectionName } from './changes';

export const OWNER_EMAIL = 'nonteerapong8@gmail.com';
export const IS_DEMO = import.meta.env.DEV && new URLSearchParams(location.search).get('demo') === '1';
const app = initializeApp(config);
export const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = 'th';
export function emptyData(): Data { return { version: 1, revision: '', services: [], members: [], subscriptions: [] }; }
export function isOwner(user: User | null) { return user?.email === OWNER_EMAIL && user.emailVerified && user.providerData.some(provider => provider.providerId === 'google.com'); }
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account', login_hint: OWNER_EMAIL });
  const result = await signInWithPopup(auth, provider);
  if (!isOwner(result.user)) { await signOut(auth); throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน กรุณาใช้บัญชีเจ้าของ Family'); }
}
export const logout = () => signOut(auth);
export function firebaseError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'ยกเลิกการเข้าสู่ระบบแล้ว',
    'auth/cancelled-popup-request': 'กรุณารอหน้าต่างเข้าสู่ระบบที่เปิดอยู่',
    'auth/popup-blocked': 'เบราว์เซอร์บล็อกหน้าต่าง Google กรุณาอนุญาตป๊อปอัปแล้วลองใหม่',
    'auth/unauthorized-domain': 'โดเมนนี้ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ',
    'auth/operation-not-allowed': 'ยังไม่ได้เปิด Google Login ใน Firebase Authentication',
    'auth/configuration-not-found': 'ยังไม่ได้เปิด Authentication ใน Firebase กรุณาเปิด Google Login ก่อนใช้งาน',
    'auth/network-request-failed': 'เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่',
    'permission-denied': 'ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของ',
    'unavailable': 'เชื่อมต่อ Firebase ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่',
    'unauthenticated': 'การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  };
  return code ? messages[code] ?? 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่' : error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่';
}
export async function fetchData(): Promise<Data> {
  if (!isOwner(auth.currentUser)) throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของ');
  const uid = auth.currentUser!.uid;
  const data = emptyData();
  const versions: string[] = [];
  await Promise.all((Object.keys(fields) as CollectionName[]).map(async name => {
    const snapshot = await getDocsFromServer(collection(db, name));
    const records = snapshot.docs.map(item => {
      const value = item.data();
      versions.push(`${name}/${item.id}:${value.updatedAt?.seconds ?? 0}:${value.updatedAt?.nanoseconds ?? 0}`);
      return { id: item.id, ...recordFields(name, value) };
    });
    Object.assign(data, { [name]: records });
  }));
  if (auth.currentUser?.uid !== uid || !isOwner(auth.currentUser)) throw new Error('บัญชีที่เข้าสู่ระบบเปลี่ยนแล้ว');
  const settings = await getDocFromServer(doc(db, 'settings', 'messages'));
  const templates = settings.exists() ? settings.data().templates : defaultTemplates;
  if (!validTemplates(templates)) throw new Error('รูปแบบข้อความที่บันทึกไว้ไม่ถูกต้อง');
  data.messageTemplates = templates;
  data.services.sort((a, b) => a.sortOrder - b.sortOrder);
  data.members.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  data.revision = versions.sort().join('|');
  if (!isData(data)) throw new Error('ข้อมูล Firebase ไม่ครบหรือมีความสัมพันธ์ไม่ถูกต้อง กรุณาตรวจฐานข้อมูล');
  return data;
}
export async function saveChanges(previous: Data, next: Data) {
  if (!isOwner(auth.currentUser)) throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของ');
  if (!navigator.onLine) throw new Error('ไม่มีอินเทอร์เน็ต ยังไม่ได้บันทึก กรุณาเชื่อมต่อแล้วลองใหม่');
  const changes = planChanges(previous, next);
  if (!changes.length) return;
  await runTransaction(db, async transaction => {
    const reads = await Promise.all(changes.map(change => transaction.get(doc(db, change.collection, change.id))));
    // Recheck all subscriptions when deleting a member, including changes from another tab.
    for (const change of changes.filter(c => c.collection === 'members' && c.delete)) {
      const subscriptions = await getDocsFromServer(query(collection(db, 'subscriptions'), where('memberId', '==', change.id)));
      const expected = changes.filter(c => c.collection === 'subscriptions' && c.delete && (c.before as { memberId: string }).memberId === change.id);
      if (subscriptions.size !== expected.length || subscriptions.docs.some(item => !expected.some(c => c.id === item.id))) throw new Error('บริการของสมาชิกเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนลบ');
    }
    // Touch an existing member when adding a subscription so concurrent deletion retries.
    const parents = [...new Set(changes.filter(c => c.collection === 'subscriptions' && !c.before).map(c => c.value.memberId as string))].filter(id => !changes.some(c => c.collection === 'members' && c.id === id));
    for (const id of parents) {
      const parent = await transaction.get(doc(db, 'members', id));
      if (!parent.exists()) throw new Error('สมาชิกถูกลบแล้ว กรุณาโหลดข้อมูลล่าสุด');
    }
    for (let index = 0; index < changes.length; index++) {
      const change = changes[index], snapshot = reads[index];
      if (change.before ? !snapshot.exists() || !sameRecord(change.collection, snapshot.data(), change.before) : snapshot.exists()) throw new Error('ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดและเปิดรายการใหม่ก่อนบันทึก');
    }
    for (const id of parents) transaction.update(doc(db, 'members', id), { updatedAt: serverTimestamp() });
    for (const change of changes) {
      const reference = doc(db, change.collection, change.id);
      if (change.delete) transaction.delete(reference);
      else if (change.before) transaction.update(reference, { ...change.value, updatedAt: serverTimestamp() });
      else transaction.set(reference, { ...change.value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  });
}

export async function saveMessageTemplates(previous: MessageTemplates, next: MessageTemplates) {
  if (!isOwner(auth.currentUser)) throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของ');
  if (!navigator.onLine) throw new Error('ไม่มีอินเทอร์เน็ต ยังไม่ได้บันทึก');
  if (!validTemplates(next)) throw new Error('กรุณาตรวจข้อความและตัวแปรก่อนบันทึก');
  await runTransaction(db, async transaction => {
    const ref = doc(db, 'settings', 'messages');
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? snapshot.data().templates : defaultTemplates;
    if (Object.keys(defaultTemplates).some(key => current[key] !== previous[key as keyof MessageTemplates])) throw new Error('รูปแบบข้อความถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
    transaction.set(ref, { templates: next, createdAt: snapshot.exists() ? snapshot.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() });
  });
}
