/**
 * UI-side wrappers around invite RPCs.
 * Map repo errors onto the existing cloud-banner UX and trigger refresh on success.
 */
import { useCallback } from 'react';
import { acceptInvite, cancelInvite, rejectInvite } from '../../data/invitesRepo';

type AppError = { message?: string };

export interface FriendInviteActions {
  acceptInvite: (inviteId: string) => Promise<string | null>;
  rejectInvite: (inviteId: string) => Promise<string | null>;
  cancelInvite: (inviteId: string) => Promise<string | null>;
}

export function useFriendInviteActions(
  notifyCloudFailure: (msg: string) => void,
  refreshCloudData: () => Promise<void>,
): FriendInviteActions {
  const run = useCallback(
    async (
      fn: (id: string) => Promise<void>,
      id: string,
      failMsg: string,
    ): Promise<string | null> => {
      try {
        await fn(id);
      } catch (err) {
        notifyCloudFailure((err as AppError)?.message || '');
        return failMsg;
      }
      void refreshCloudData();
      return null;
    },
    [notifyCloudFailure, refreshCloudData],
  );

  return {
    acceptInvite: useCallback(
      id => run(acceptInvite, id, 'Nie udało się zaakceptować zaproszenia.'),
      [run],
    ),
    rejectInvite: useCallback(
      id => run(rejectInvite, id, 'Nie udało się odrzucić zaproszenia.'),
      [run],
    ),
    cancelInvite: useCallback(
      id => run(cancelInvite, id, 'Nie udało się cofnąć zaproszenia.'),
      [run],
    ),
  };
}
