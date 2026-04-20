import { useState, useEffect, useCallback } from 'react';
import { loadLS, saveLS } from '../lib/storage';

interface SharedSession {
  sourceSessionId?: string;
  [key: string]: unknown;
}

interface Invite {
  id: string;
  [key: string]: unknown;
}

interface UseUnreadBadgesProps {
  userId: string | null | undefined;
  sharedHistory: SharedSession[];
  pendingInvites: Invite[];
}

export function useUnreadBadges({ userId, sharedHistory, pendingInvites }: UseUnreadBadgesProps) {
  const seenSharedKey = userId ? `poker_${userId}_seen_shared` : null;
  const seenInvitesKey = userId ? `poker_${userId}_seen_invites` : null;

  const [seenSharedIds, setSeenSharedIds] = useState<Set<string>>(() => {
    if (!userId) return new Set();
    const arr = loadLS<string[]>(seenSharedKey!, []);
    return new Set(arr);
  });

  const [seenInviteIds, setSeenInviteIds] = useState<Set<string>>(() => {
    if (!userId) return new Set();
    const arr = loadLS<string[]>(seenInvitesKey!, []);
    return new Set(arr);
  });

  useEffect(() => {
    if (!userId) return;
    const arr = loadLS<string[]>(`poker_${userId}_seen_shared`, []);
    setSeenSharedIds(new Set(arr));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const arr = loadLS<string[]>(`poker_${userId}_seen_invites`, []);
    setSeenInviteIds(new Set(arr));
  }, [userId]);

  const hasNewShared = sharedHistory.some(s => {
    const src = s.sourceSessionId;
    return typeof src === 'string' && src.length > 0 && !seenSharedIds.has(src);
  });

  const hasNewInvites = pendingInvites.some(inv => !seenInviteIds.has(inv.id));

  const markSharedSeen = useCallback(() => {
    if (!seenSharedKey) return;
    const ids = sharedHistory
      .map(s => s.sourceSessionId)
      .filter((src): src is string => typeof src === 'string' && src.length > 0);
    const next = new Set([...seenSharedIds, ...ids]);
    setSeenSharedIds(next);
    saveLS(seenSharedKey, Array.from(next));
  }, [seenSharedKey, sharedHistory, seenSharedIds]);

  const markInvitesSeen = useCallback(() => {
    if (!seenInvitesKey) return;
    const ids = pendingInvites.map(inv => inv.id);
    const next = new Set([...seenInviteIds, ...ids]);
    setSeenInviteIds(next);
    saveLS(seenInvitesKey, Array.from(next));
  }, [seenInvitesKey, pendingInvites, seenInviteIds]);

  return { hasNewShared, hasNewInvites, markSharedSeen, markInvitesSeen };
}
