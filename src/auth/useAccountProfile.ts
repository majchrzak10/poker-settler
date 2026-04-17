// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/** Jeden wiersz `public.profiles` dla zalogowanego użytkownika (konto vs wiersz `players`). */
export function useAccountProfile(user) {
  const [profile, setProfile] = useState(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) {
      console.warn('useAccountProfile', error.message);
      return;
    }
    setProfile(data ?? null);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, setProfile, reload };
}
