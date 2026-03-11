import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { aiEngine, type AIProviderType, type AIProviderConfig } from '@/lib/ai';

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upsert connection
      const { error } = await supabase.from('ai_connections').upsert(
        {
          user_id: user.id,
          provider,
          api_key_encrypted: apiKey, // TODO: encrypt before storing
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
      const { data: { user } } = await supabase.auth.getUser();
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

export function useInitializeAI() {
  const { data: connection } = useAIConnection();

  React.useEffect(() => {
    if (connection) {
      aiEngine.configure(connection.provider, {
        apiKey: connection.api_key_encrypted, // TODO: decrypt
        model: connection.model,
        baseUrl: connection.base_url,
      });
    }
  }, [connection]);
}
