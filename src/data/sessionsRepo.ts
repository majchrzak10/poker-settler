/**
 * Sessions repo — thin re-export from src/sync/persistSession.ts.
 *
 * The functions there (save/update/delete + repair) are already the data
 * layer for sessions: they orchestrate atomic RPC + fallback sequential
 * inserts and translate Supabase errors into app-typed ones. The re-export
 * keeps the *Repo.ts naming consistent (invitesRepo, playersRepo,
 * profileRepo, sessionsRepo) so callers find them all under src/data/.
 */
export {
  isSessionConflictError,
  persistSessionDeleteCloud as deleteSessionCloud,
  persistSessionSaveCloud as saveSessionCloud,
  persistSessionUpdateCloud as updateSessionCloud,
  repairSessionPlayersRows,
} from '../sync/persistSession';
