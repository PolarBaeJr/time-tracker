import * as React from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { UserSchema } from '@/schemas';
import { supabase, type Session } from '@/lib';
import type { User as UserProfile } from '@/types';
import { applyServerPreferences, setSyncCallback } from '@/hooks/usePomodoroSettings';

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
  // Electron: use localhost callback server so the system browser handles
  // the OAuth flow (including passkeys/Touch ID) and auto-closes after sign-in.
  if (typeof window !== 'undefined' && window.desktop?.platform?.isElectron) {
    return 'http://127.0.0.1:54321/auth/callback';
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }

  return 'worktracker://auth/callback';
}

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

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

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Electron: listen for the OAuth callback URL sent via IPC from main process.
  // Uses exchangeCodeForSession so Supabase can complete the PKCE code exchange
  // using the code_verifier it stored in localStorage before the flow started.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.desktop?.platform?.isElectron) return;

    window.desktop.onOAuthCallback(async (tokenJson: string) => {
      try {
        const tokens = JSON.parse(tokenJson);
        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (error) {
          console.error('[AuthContext] OAuth setSession failed:', error.message);
          setLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] OAuth callback error:', err);
        setLoading(false);
      }
    });
  }, []);

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

      let nextUser: UserProfile | null = null;
      try {
        nextUser = await fetchUserProfile(nextSession.user.id);
      } catch (err) {
        console.warn('[AuthContext] Profile fetch failed:', err);
      }

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

  // Sync preferences: apply server prefs on login, push local changes to server
  React.useEffect(() => {
    if (!user) {
      setSyncCallback(null);
      return;
    }

    // Server wins: apply preferences from profile on login
    if (user.preferences && typeof user.preferences === 'object') {
      applyServerPreferences(user.preferences as Parameters<typeof applyServerPreferences>[0]);
    }

    // Purge soft-deleted entries older than 30 days (fire-and-forget)
    void supabase.rpc('purge_old_soft_deleted_entries').then(({ error }) => {
      if (error) console.warn('[AuthContext] Purge failed:', error.message);
    });

    // Set up callback to push local changes to server (fire-and-forget)
    setSyncCallback(prefs => {
      void supabase
        .from('users')
        .update({ preferences: prefs, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) {
            console.warn('[AuthContext] Failed to sync preferences:', error.message);
          }
        });
    });

    return () => {
      setSyncCallback(null);
    };
  }, [user]);

  const signInWithGoogle = async (): Promise<void> => {
    setLoading(true);

    const isElectron = typeof window !== 'undefined' && window.desktop?.platform?.isElectron;
    const isNative = Platform.OS !== 'web';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
        // Skip automatic browser redirect on Electron and native so we can
        // open the URL ourselves via the appropriate mechanism.
        skipBrowserRedirect: isElectron || isNative ? true : undefined,
      },
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    if (isElectron && data.url) {
      await window.desktop!.openExternalUrl(data.url);
    } else if (isNative && data.url) {
      // Open system browser for OAuth, then handle deep link redirect back
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        Linking.createURL('auth/callback')
      );

      if (result.type === 'success') {
        const url = result.url;
        // Extract query params manually (URL constructor may not support custom schemes)
        const queryString = url.split('?')[1]?.split('#')[0] ?? '';
        const params = new URLSearchParams(queryString);
        const code = params.get('code');

        if (code) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) {
            console.error('[AuthContext] Native OAuth code exchange failed:', sessionError.message);
            setLoading(false);
          }
          // On success, onAuthStateChange fires syncSession which handles loading state
        } else {
          // Fallback: check for tokens in fragment (implicit flow)
          const fragment = url.split('#')[1] ?? '';
          const fragParams = new URLSearchParams(fragment);
          const accessToken = fragParams.get('access_token');
          const refreshToken = fragParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              console.error('[AuthContext] Native OAuth setSession failed:', sessionError.message);
              setLoading(false);
            }
            // On success, onAuthStateChange fires syncSession which handles loading state
          } else {
            setLoading(false);
          }
        }
      } else {
        // User cancelled or dismissed the browser
        setLoading(false);
      }
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
