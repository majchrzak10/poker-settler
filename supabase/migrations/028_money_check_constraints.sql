-- 028: W3 — CHECK constraints na kwoty pieniężne.
--
-- Wszystkie kolumny pieniężne są bigint w centach (plnToCents → Math.round(n*100)).
-- Cap: 10^11 centów = 1 mld PLN. Każda sensowna wartość mieści się znacznie niżej.
-- Reject: ujemne (atak), NaN/Inf (zostają centy=0 w plnToCents, ale dla pewności),
-- oraz wartości >cap (atak / pomyłka / overflow).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participations_buy_in_range') THEN
    ALTER TABLE public.participations
      ADD CONSTRAINT participations_buy_in_range
      CHECK (total_buy_in >= 0 AND total_buy_in <= 100000000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participations_cash_out_range') THEN
    ALTER TABLE public.participations
      ADD CONSTRAINT participations_cash_out_range
      CHECK (cash_out IS NULL OR (cash_out >= 0 AND cash_out <= 100000000000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participations_total_pot_range') THEN
    ALTER TABLE public.participations
      ADD CONSTRAINT participations_total_pot_range
      CHECK (total_pot IS NULL OR (total_pot >= 0 AND total_pot <= 100000000000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_players_buy_in_range') THEN
    ALTER TABLE public.session_players
      ADD CONSTRAINT session_players_buy_in_range
      CHECK (total_buy_in >= 0 AND total_buy_in <= 100000000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_players_cash_out_range') THEN
    ALTER TABLE public.session_players
      ADD CONSTRAINT session_players_cash_out_range
      CHECK (cash_out IS NULL OR (cash_out >= 0 AND cash_out <= 100000000000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_total_pot_range') THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_total_pot_range
      CHECK (total_pot IS NULL OR (total_pot >= 0 AND total_pot <= 100000000000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfers_amount_range') THEN
    ALTER TABLE public.transfers
      ADD CONSTRAINT transfers_amount_range
      CHECK (amount >= 0 AND amount <= 100000000000);
  END IF;
END $$;
