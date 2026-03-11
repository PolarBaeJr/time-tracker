import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { aiEngine, type AIProviderType, type AIProviderConfig } from '@/lib/ai';
import { encryptApiKey, decryptApiKey, isEncrypted } from '@/lib/crypto';

const AI_QUERY_KEYS = {
  connection: ['aiConnection'] as const,
};

async function fetchAIConnection() {
  const { data, error } = await supabase
    .from('ai_connections')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export function useAIConnection() {
  return useQuery({
    queryKey: AI_QUERY_KEYS.connection,
    queryFn: fetchAIConnection,
  });
}

export function useConfigureAI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      apiKey,
      model,
      baseUrl,
    }: {
      provider: AIProviderType;
      apiKey: string;
      model?: string;
      baseUrl?: string;
    }) => {
      // Configure engine
      aiEngine.configure(provider, { apiKey, model, baseUrl });

      // Validate
      const valid = await aiEngine.validateKey();
      if (!valid) throw new Error('Invalid API key or unreachable server');

      // Get user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Deactivate all existing providers for this user first
      const { error: deactivateError } = await supabase
        .from('ai_connections')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (deactivateError) throw new Error(deactivateError.message);

      // Encrypt the API key before storing
      const encryptedKey = await encryptApiKey(apiKey, user.id);

      // Upsert connection with is_active=true
      const { error } = await supabase.from('ai_connections').upsert(
        {
          user_id: user.id,
          provider,
          api_key_encrypted: encryptedKey,
          model: model || null,
          base_url: baseUrl || null,
          is_active: true,
        },
        { onConflict: 'user_id,provider' }
      );

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.connection });
    },
  });
}

export function useDisconnectAI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('ai_connections')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      aiEngine.disconnect();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.connection });
    },
  });
}

/**
 * Initialize the AI engine with the stored connection settings.
 *
 * API keys are encrypted server-side using AES-GCM with a server-managed
 * encryption key (stored as a Supabase secret). This function calls the
 * server-side decrypt endpoint to retrieve the key for AI engine initialization.
 */
export function useInitializeAI() {
  const { data: connection } = useAIConnection();

  React.useEffect(() => {
    if (!connection) return;

    const initializeEngine = async () => {
      try {
        // Get current user for decryption key derivation
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const storedKey = connection.api_key_encrypted;
        if (!storedKey) {
          console.warn('No API key found in AI connection');
          return;
        }

        let apiKey: string;

        // Decrypt the API key if it's encrypted
        // (handles migration from plaintext to encrypted storage)
        if (isEncrypted(storedKey)) {
          try {
            apiKey = await decryptApiKey(storedKey, user.id);
          } catch (decryptError) {
            console.error('Failed to decrypt API key:', decryptError);
            // Do NOT fall back to using ciphertext as the API key - this would
            // configure providers with invalid keys and mask the real failure
            return;
          }
        } else {
          // Legacy plaintext key - use as-is (for backward compatibility during migration)
          apiKey = storedKey;
        }

        aiEngine.configure(connection.provider, {
          apiKey,
          model: connection.model,
          baseUrl: connection.base_url,
        });
      } catch (error) {
        console.error('Failed to initialize AI engine:', error);
      }
    };

    void initializeEngine();
  }, [connection]);
}
