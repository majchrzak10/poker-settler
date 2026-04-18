import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

/** Jeden wiersz `public.profiles` dla zalogowanego użytkownika (konto vs wiersz `players`). */
export function useAccountProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
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
