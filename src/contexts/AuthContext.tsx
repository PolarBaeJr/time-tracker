import * as React from 'react';
import { Platform } from 'react-native';

import { UserSchema } from '@/schemas';
import { supabase, type Session } from '@/lib';
import type { User as UserProfile } from '@/types';

export interface AuthContextValue {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }

  return 'worktracker://auth/callback';
}

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[AuthContext] Failed to fetch user profile:', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const parsedProfile = UserSchema.safeParse(data);

  if (!parsedProfile.success) {
    console.warn('[AuthContext] User profile failed validation:', parsedProfile.error.flatten());
    return null;
  }

  return parsedProfile.data;
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isActive = true;
    let latestRequestId = 0;

    const syncSession = async (nextSession: Session | null): Promise<void> => {
      const requestId = ++latestRequestId;

      setSession(nextSession);

      if (!nextSession) {
        if (isActive && requestId === latestRequestId) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const nextUser = await fetchUserProfile(nextSession.user.id);

      if (!isActive || requestId !== latestRequestId) {
        return;
      }

      setUser(nextUser);
      setLoading(false);
    };

    const initializeAuth = async (): Promise<void> => {
      setLoading(true);

      const { data, error } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        console.warn('[AuthContext] Failed to restore session:', error.message);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      await syncSession(data.session);
    };

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    void initializeAuth();

    return () => {
      isActive = false;
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    });

    if (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoading(false);
      throw error;
    }

    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const refreshUser = async (): Promise<void> => {
    const currentSession = await supabase.auth.getSession();
    const userId = currentSession.data.session?.user.id;
    if (!userId) return;
    const profile = await fetchUserProfile(userId);
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: session !== null,
        signInWithGoogle,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
