import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/format';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center">
      <p className="text-green-200/50 text-sm">Ładowanie...</p>
    </div>
  );
}

export function EmailConfirmedScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-6xl">✅</div>
        <div>
          <h2 className="text-2xl font-bold text-white">Konto aktywowane!</h2>
          <p className="text-green-200/60 text-sm mt-2">
            Twój adres email został potwierdzony. Możesz się teraz zalogować.
          </p>
        </div>
        <button
          onClick={onContinue}
          className="w-full bg-rose-800 hover:bg-rose-900 rounded-xl py-3 text-sm font-semibold transition-colors"
        >
          Przejdź do logowania
        </button>
      </div>
    </div>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      const raw = (authError.message || '').toLowerCase();
      if (raw.includes('email not confirmed') || raw.includes('not confirmed')) {
        setError(
          'Konto nie jest jeszcze aktywne. Otwórz mail z linkiem aktywacyjnym, potwierdź adres, a następnie zaloguj się ponownie.'
        );
      } else if (
        raw.includes('invalid login credentials') ||
        raw.includes('invalid credentials')
      ) {
        setError('Nieprawidłowy email lub hasło.');
      } else {
        setError(authError.message || 'Nie udało się zalogować.');
      }
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    if (password !== passwordConfirm) {
      setError('Hasła nie są identyczne.');
      setLoading(false);
      return;
    }
    if (regPhone.length !== 11) {
      setError('Podaj pełny numer telefonu (9 cyfr).');
      setLoading(false);
      return;
    }
    const displayName = name.trim() || email.trim().split('@')[0];
    const phoneDigits = regPhone.replace(/\D/g, '');
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname || '/'}`
            : undefined,
        data: { display_name: displayName, phone: phoneDigits },
      },
    });
    if (authError) {
      const em = (authError.message || '').toLowerCase();
      if (em.includes('already registered') || em.includes('user already')) {
        setError('Ten adres jest już zarejestrowany — użyj logowania.');
      } else {
        setError(authError.message || 'Nie udało się utworzyć konta.');
      }
      setLoading(false);
      return;
    }
    if (data.session && data.user) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          display_name: displayName,
          email: email.trim().toLowerCase(),
          phone: phoneDigits || null,
        },
        { onConflict: 'id' }
      );
      setLoading(false);
      return;
    }
    if (data.user) {
      setSuccess(
        'Na podany adres wysłaliśmy wiadomość z linkiem aktywacyjnym. Otwórz mail, kliknij link — po aktywacji możesz się zalogować. (Sprawdź też folder Spam.)'
      );
    } else {
      setSuccess('Sprawdź skrzynkę pocztową i postępuj według instrukcji z wiadomości.');
    }
    setMode('login');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">♠ Poker Settler</h1>
          <p className="text-green-200/50 text-sm mt-2">Rozlicz grę ze znajomymi</p>
        </div>
        <div className="bg-black/30 border border-green-900 rounded-2xl p-6 space-y-4">
          <div className="flex bg-black/30 border border-green-900 rounded-xl p-1 gap-1">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setSuccess('');
                  setPasswordConfirm('');
                  setRegPhone('');
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-rose-800 text-white' : 'text-green-200/60 hover:text-green-200'}`}
              >
                {m === 'login' ? 'Logowanie' : 'Rejestracja'}
              </button>
            ))}
          </div>
          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            className="space-y-3"
          >
            {mode === 'register' && (
              <input
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Imię (opcjonalne)"
                className="w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border border-green-800 focus:outline-none focus:border-rose-600 transition-colors"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="Email *"
              required
              className="w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border border-green-800 focus:outline-none focus:border-rose-600 transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="Hasło (min. 6 znaków) *"
              required
              minLength={6}
              className="w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border border-green-800 focus:outline-none focus:border-rose-600 transition-colors"
            />
            {mode === 'register' && (
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPasswordConfirm(e.target.value)}
                placeholder="Potwierdź hasło *"
                required
                minLength={6}
                className="w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border border-green-800 focus:outline-none focus:border-rose-600 transition-colors"
              />
            )}
            {mode === 'register' && (() => {
              const phoneError = regPhone.length > 0 && regPhone.length < 11;
              return (
                <div className="space-y-1">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={regPhone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setRegPhone(formatPhone(e.target.value))
                    }
                    placeholder="Numer telefonu *"
                    maxLength={11}
                    className={`w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border transition-colors focus:outline-none ${phoneError ? 'border-red-500' : 'border-green-800 focus:border-rose-600'}`}
                  />
                  {phoneError && (
                    <p className="text-xs text-red-400 px-1">Podaj pełny, 9-cyfrowy numer telefonu</p>
                  )}
                </div>
              );
            })()}
            {error && <p className="text-xs text-rose-400 px-1">{error}</p>}
            {success && <p className="text-xs text-emerald-400 px-1">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose-800 hover:bg-rose-900 disabled:opacity-50 rounded-xl py-3 text-sm font-semibold transition-colors"
            >
              {loading ? 'Ładowanie...' : mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
