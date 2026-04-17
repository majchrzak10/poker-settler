/**
 * Typ bazy dla `createClient<Database>()`.
 *
 * **Pełne typy:** po `supabase login` + `supabase link` uruchom `npm run gen:types`
 * — CLI nadpisze ten plik (w tym `Json` i dokładne `Tables` / `Functions`).
 *
 * **Do tego czasu `Database = any`:** luźny stub (`Record<...>`) bez `any` powodował,
 * że PostgREST inferował `Row` jako `unknown` / `never` i psuł typy w całym projekcie.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Zastąp wyjściem `npm run gen:types` (pełny obiekt `Database` z CLI). */
export type Database = any;
