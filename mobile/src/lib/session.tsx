import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, fetchMe, login as requestLogin, logout as requestLogout, type Session } from './api';
import { clearSessionToken, readSessionToken, writeSessionToken } from './secure-session';

export type SessionStatus = 'loading' | 'signed_in' | 'signed_out';

export type SignInResult = { ok: true } | { ok: false; message: string };

type SessionContextValue = {
  status: SessionStatus;
  session: Session | null;
  message: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

export const NO_NATIVE_SESSION_MESSAGE =
  '로그인 정보를 받지 못했습니다. 잠시 후 다시 시도해 주세요.';

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    const token = await readSessionToken();
    if (!token) {
      setSession(null);
      setMessage(null);
      setStatus('signed_out');
      return;
    }
    try {
      const next = await fetchMe(token);
      setSession(next);
      setMessage(null);
      setStatus('signed_in');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSessionToken();
        setSession(null);
        setMessage('세션이 만료되었습니다. 다시 로그인해 주세요.');
        setStatus('signed_out');
        return;
      }
      setSession(null);
      setMessage(error instanceof Error ? error.message : '세션을 확인하지 못했습니다.');
      setStatus('signed_out');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    try {
      const result = await requestLogin(email, password);
      if (!result.token) {
        setSession(null);
        setMessage(NO_NATIVE_SESSION_MESSAGE);
        setStatus('signed_out');
        return { ok: false, message: NO_NATIVE_SESSION_MESSAGE };
      }
      await writeSessionToken(result.token);

      try {
        const next = await fetchMe(result.token);
        setSession(next);
        setMessage(null);
        setStatus('signed_in');
        return { ok: true };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSessionToken();
          const text = '로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.';
          setSession(null);
          setMessage(text);
          setStatus('signed_out');
          return { ok: false, message: text };
        }
        if (result.session) {
          setSession(result.session);
          setMessage(null);
          setStatus('signed_in');
          return { ok: true };
        }
        const text = error instanceof Error ? error.message : '세션을 확인하지 못했습니다.';
        setSession(null);
        setMessage(text);
        setStatus('signed_out');
        return { ok: false, message: text };
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : '로그인하지 못했습니다.';
      setMessage(text);
      return { ok: false, message: text };
    }
  }, []);

  const signOut = useCallback(async () => {
    const token = await readSessionToken();
    if (token) {
      try {
        await requestLogout(token);
      } catch {}
    }
    await clearSessionToken();
    setSession(null);
    setMessage(null);
    setStatus('signed_out');
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, session, message, signIn, signOut, reload }),
    [message, reload, session, signIn, signOut, status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider 안에서만 useSession 을 사용할 수 있습니다.');
  return value;
}
