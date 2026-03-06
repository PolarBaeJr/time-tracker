import { supabase, type Session, type User as AuthUser } from '@/lib';

import { useAuth } from './useAuth';

export interface UseSessionResult {
  session: Session | null;
  authUser: AuthUser | null;
  expiresAt: number | null;
  expiresAtDate: Date | null;
  hasExpired: () => boolean;
  isExpiringSoon: (thresholdSeconds?: number) => boolean;
  refreshSession: () => Promise<Session | null>;
}

export function useSession(): UseSessionResult {
  const { session } = useAuth();

  const expiresAt = session?.expires_at ?? null;
  const expiresAtDate = expiresAt ? new Date(expiresAt * 1000) : null;
  const authUser = session?.user ?? null;

  const isExpiringSoon = (thresholdSeconds = 300): boolean => {
    if (!expiresAt) {
      return true;
    }

    const nowInSeconds = Date.now() / 1000;
    return expiresAt - nowInSeconds <= thresholdSeconds;
  };

  const refreshSession = async (): Promise<Session | null> => {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }

    return data.session;
  };

  return {
    session,
    authUser,
    expiresAt,
    expiresAtDate,
    hasExpired: (): boolean => (expiresAt ? expiresAt * 1000 <= Date.now() : true),
    isExpiringSoon,
    refreshSession,
  };
}

export default useSession;
