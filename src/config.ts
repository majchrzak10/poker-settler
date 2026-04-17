/** Supabase — wartości domyślne z projektu; w Netlify ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY. */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://oatfqrijmwdnkztgvzwx.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_FHu3tWQSK9vt6XJGL3e7Vw_vPm5udfA';
