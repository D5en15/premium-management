import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, emptyData, fetchData, firebaseError, isOwner, IS_DEMO, logout } from './firebase';

export function useFirebase() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(IS_DEMO);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(!IS_DEMO);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const mounted = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!isOwner(auth.currentUser)) return;
    const current = ++generation.current;
    try {
      const value = await fetchData();
      if (mounted.current && current === generation.current) { setData(value); setError(''); setLoading(false); }
    } catch (err) {
      if (mounted.current && current === generation.current) { setError(firebaseError(err)); setLoading(false); }
    }
  }, []);
  useEffect(() => {
    if (IS_DEMO) return;
    mounted.current = true;
    const unsubscribe = onAuthStateChanged(auth, next => {
      generation.current++;
      setData(emptyData()); setError(''); setLoading(Boolean(next));
      if (next && !isOwner(next)) {
        setUser(null); setAuthReady(true); setLoading(false);
        setAuthError('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน กรุณาใช้บัญชีเจ้าของ Family');
        void logout();
      } else {
        setUser(next); setAuthReady(true);
        if (next) { setAuthError(''); void refresh(); }
      }
    }, () => { setAuthError('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่'); setAuthReady(true); setLoading(false); });
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus); window.addEventListener('online', onFocus);
    const timer = setInterval(onFocus, 60_000);
    return () => { mounted.current = false; generation.current++; unsubscribe(); clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus); };
  }, [refresh]);
  return { user, authReady, data, setData, loading, error, authError, refresh };
}
