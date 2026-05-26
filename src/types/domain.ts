/**
 * Shared domain types — single source of truth for entities that flow between
 * App, the cloud-sync hooks, and feature components. Previously these were
 * cloned (often with subtle drift) across App.tsx, useCloudSync.ts,
 * HistoryTab.tsx and ProfileView.tsx.
 */

export interface SessionPlayer {
  playerId: string;
  buyIns: number[];
  cashOut: string;
}

export interface Transaction {
  from: string;
  to: string;
  amount: number;
  toPhone?: string;
}

export interface HistorySessionPlayer {
  id: string;
  name: string;
  phone?: string;
  totalBuyIn: number;
  cashOut: number;
  netBalance: number;
  [key: string]: unknown;
}

export interface HistoryTransfer {
  from: string;
  to: string;
  amount: number;
  toPhone?: string;
}

export interface HistorySession {
  id: string;
  date: string;
  totalPot: number;
  players: HistorySessionPlayer[];
  transfers: HistoryTransfer[];
  shared?: boolean;
  sharedNote?: string;
  /** Cloud row version timestamp for optimistic locking. */
  updated_at?: string;
  [key: string]: unknown;
}

export interface SyncMeta {
  lastError: string | null;
  [key: string]: unknown;
}

export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface PendingInvite {
  id: string;
  invitee_email: string;
  created_at: string;
  requester_user_id: string;
  requester_player_id: string;
  requester_name: string;
  requester_email: string;
}

export interface OutgoingInvite {
  id: string;
  invitee_email: string;
  status: InviteStatus;
}

export interface InviteMeta {
  id: string;
  status: InviteStatus;
  created_at: string;
  responded_at: string | null;
}
