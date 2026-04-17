import { IconUsers, IconPlay, IconCalc, IconTrophy, IconUser } from '../ui/icons';

export const TABS = [
  { key: 'players', label: 'Gracze', Icon: IconUsers, aria: 'Zakładka Gracze — baza osób' },
  { key: 'session', label: 'Sesja', Icon: IconPlay, aria: 'Zakładka Sesja — buy-iny przy stole' },
  { key: 'settlement', label: 'Wyniki', Icon: IconCalc, aria: 'Zakładka Wyniki — cash-outy i przelewy' },
  { key: 'history', label: 'Historia', Icon: IconTrophy, aria: 'Zakładka Historia — archiwum i ranking' },
  { key: 'profile', label: 'Profil', Icon: IconUser, aria: 'Zakładka Profil — konto i synchronizacja' },
];

export const SCREEN_META: Record<string, string> = {
  players: 'Dodaj stałych graczy, zanim zaczniesz sesję.',
  session: 'Ustal buy-iny i kogo masz przy stole.',
  settlement: '',
  history: 'Archiwum sesji i ranking.',
  profile: 'Konto i synchronizacja z chmurą.',
};
