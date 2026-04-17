import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const type = hashParams.get('type') || searchParams.get('type');
    const hasToken =
      hashParams.get('access_token') || searchParams.get('token_hash') || searchParams.get('code');
    if (hasToken && (type === 'signup' || type === 'email_confirmation')) {
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return false;
  });
  useEffect(() => {
    let active = true;
    const applySession = (session: { user: unknown } | null) => {
      if (!active) return;
      setUser((session?.user as unknown) ?? null);
      setLoading(false);
    };
    const syncSessionFromStorage = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn('auth.getSession', error.message || error);
      applySession(data?.session ?? null);
    };
    void syncSessionFromStorage();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }
      applySession(session);
    });
    const onFocus = () => {
      void syncSessionFromStorage();
    };
    const onVisibility = () => {
      if (!document.hidden) void syncSessionFromStorage();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      subscription.unsubscribe();
    };
  }, []);
  return { user, loading, emailConfirmed, setEmailConfirmed };
}
