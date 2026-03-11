/**
 * Edge Function: encrypt-api-key
 *
 * Encrypts API keys server-side using AES-256-GCM with a server-managed
 * encryption key. The encryption key is stored as a Supabase secret and
 * never exposed to the client.
 *
 * Authentication: Requires valid Supabase JWT
 * Method: POST
 * Body: { apiKey: string }
 * Returns: { encryptedKey: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptApiKey, isEncryptionConfigured } from '../_shared/crypto.ts';
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';

Deno.serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      console.error('ENCRYPTION_KEY not configured');
      return errorResponse('Server encryption not configured', 500);
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse request body
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return errorResponse('Missing or invalid apiKey in request body');
    }

    // Encrypt the API key
    const encryptedKey = await encryptApiKey(apiKey, user.id);

    return jsonResponse({ encryptedKey });
  } catch (error) {
    console.error('Encryption error:', error);
    return errorResponse('Encryption failed', 500);
  }
});
