/** Argumenty dla RPC save_session_atomic / update_session_atomic. */
export function buildSessionRpcArgs(
  sessionRow: Record<string, unknown>,
  sessionPlayersRows: unknown[],
  transferRows: unknown[],
  participationRows: unknown[]
) {
  return {
    p_session_id: sessionRow.id,
    p_owner_id: sessionRow.owner_id,
    p_played_at: sessionRow.played_at,
    p_total_pot: sessionRow.total_pot,
    p_session_players: (sessionPlayersRows || []).map((r: Record<string, unknown>) => ({
      player_id: r.player_id,
      player_name: r.player_name,
      total_buy_in: r.total_buy_in,
      cash_out: r.cash_out,
    })),
    p_transfers: (transferRows || []).map((r: Record<string, unknown>) => ({
      from_name: r.from_name,
      to_name: r.to_name,
      amount: r.amount,
    })),
    p_participations: (participationRows || []).map((r: Record<string, unknown>) => ({
      user_id: r.user_id,
      player_name: r.player_name,
      total_buy_in: r.total_buy_in,
      cash_out: r.cash_out,
      session_date: r.session_date,
      total_pot: r.total_pot,
    })),
  };
}
