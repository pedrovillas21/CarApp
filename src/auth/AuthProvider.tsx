import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthError, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearActivity, isIdleExpired, markActivity } from '../lib/session';

export type Driver = { id: string; fullName: string };

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; driver: Driver };

type AuthContextValue = {
  state: AuthState;
  /** Devolve a mensagem de erro, ou null se entrou. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const EXPIRED_NOTICE = 'Sua sessão expirou depois de 24 h sem abrir o app. Entre novamente.';
const NOT_AUTHORIZED = 'Este usuário não tem acesso ao controle de frota. Fale com a administração.';

const AuthContext = createContext<AuthContextValue | null>(null);

/** null = não é condutor ativo. Erro de rede = lança. */
async function loadDriver(user: User): Promise<Driver | null> {
  const { data, error } = await supabase.from('drivers').select('id, full_name, active').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!data || !data.active) return null;
  return { id: data.id as string, fullName: data.full_name as string };
}

function offlineDriver(user: User): Driver {
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Condutor';
  return { id: user.id, fullName: name };
}

function translateAuthError(error: AuthError) {
  if (error.code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
  if (error.code === 'user_banned') return NOT_AUTHORIZED;
  if (error.code === 'over_request_rate_limit') return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (!navigator.onLine || error.status === 0 || /fetch/i.test(error.message)) return 'Sem conexão com a internet.';
  return 'Não foi possível entrar. Tente de novo.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const endSession = useCallback(async (notice?: string) => {
    clearActivity();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setState({ status: 'signedOut', notice });
  }, []);

  // Abertura do app: confere sessão salva e o prazo de 24 h.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (cancelled) return;
      if (!session) {
        setState({ status: 'signedOut' });
        return;
      }
      if (isIdleExpired()) {
        await endSession(EXPIRED_NOTICE);
        return;
      }
      markActivity();
      try {
        const driver = await loadDriver(session.user);
        if (cancelled) return;
        if (!driver) await endSession(NOT_AUTHORIZED);
        else setState({ status: 'signedIn', driver });
      } catch {
        // sem internet: segue com o nome salvo na sessão; o banco valida o acesso em cada ação
        if (!cancelled) setState({ status: 'signedIn', driver: offlineDriver(session.user) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  // Supabase encerrou a sessão (token revogado, logout em outro lugar).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setState((current) => (current.status === 'signedOut' ? current : { status: 'signedOut' }));
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Enquanto o app está aberto e visível, renova o prazo. Ao voltar para o app, confere antes.
  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (isIdleExpired()) void endSession(EXPIRED_NOTICE);
      else markActivity();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, [signedIn, endSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return translateAuthError(error);
      markActivity();
      try {
        const driver = await loadDriver(data.user);
        if (!driver) {
          await endSession();
          return NOT_AUTHORIZED;
        }
        setState({ status: 'signedIn', driver });
        return null;
      } catch {
        await endSession();
        return 'Não foi possível carregar seus dados. Tente de novo.';
      }
    },
    [endSession],
  );

  const signOut = useCallback(() => endSession(), [endSession]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}
