import type { Json } from '../types/database.types';

/** Argumenty dla RPC save_session_atomic / update_session_atomic. */
export function buildSessionRpcArgs(
  sessionRow: Record<string, unknown>,
  sessionPlayersRows: Record<string, unknown>[],
  transferRows: Record<string, unknown>[],
  participationRows: Record<string, unknown>[]
) {
  return {
    p_session_id: sessionRow.id as string,
    p_owner_id: sessionRow.owner_id as string,
    p_played_at: sessionRow.played_at as string,
    p_total_pot: sessionRow.total_pot as number,
    p_session_players: sessionPlayersRows.map(r => ({
      player_id: r.player_id,
      player_name: r.player_name,
      total_buy_in: r.total_buy_in,
      cash_out: r.cash_out,
    })) as Json,
    p_transfers: transferRows.map(r => ({
      from_name: r.from_name,
      to_name: r.to_name,
      amount: r.amount,
    })) as Json,
    p_participations: participationRows.map(r => ({
      user_id: r.user_id,
      player_name: r.player_name,
      total_buy_in: r.total_buy_in,
      cash_out: r.cash_out,
      session_date: r.session_date,
      total_pot: r.total_pot,
    })) as Json,
  };
}
