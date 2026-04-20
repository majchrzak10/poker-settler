-- 022: Poprawki niezawodności
--
-- 1. Trigger `auto_create_participation` (z 020) obecnie odpala się tylko na INSERT
--    do session_players. Gdy host EDYTUJE wynik (np. poprawia cash_out przez
--    update_session_atomic, który najpierw DELETE+INSERT, ale też przez UPDATE
--    w przyszłości), nowe wartości nie trafiały do participations.
--    Zmiana: AFTER INSERT OR UPDATE — trigger dopasuje participations przy każdej
--    zmianie session_players.
--
-- 2. Publikacja realtime dla `session_edit_proposals` (tabela dodana w 023).
--    Dorzucamy tutaj żeby nie musieć pamiętać w następnej migracji — jeśli
--    tabeli jeszcze nie ma, ALTER PUBLICATION nic nie zrobi (bezpieczne).

DROP TRIGGER IF EXISTS session_players_auto_participation ON public.session_players;
CREATE TRIGGER session_players_auto_participation
  AFTER INSERT OR UPDATE ON public.session_players
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_participation();
