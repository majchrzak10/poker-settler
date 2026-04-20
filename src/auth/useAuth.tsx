import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenRefreshedAt, setTokenRefreshedAt] = useState<number>(0);
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
    const applySession = (session: { user: User } | null) => {
      if (!active) return;
      setUser(session?.user ?? null);
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }
      if (_event === 'TOKEN_REFRESHED') {
        setTokenRefreshedAt(Date.now());
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
  return { user, loading, emailConfirmed, setEmailConfirmed, tokenRefreshedAt };
}
