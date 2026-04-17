import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import type { Database } from '../types/database.types';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
