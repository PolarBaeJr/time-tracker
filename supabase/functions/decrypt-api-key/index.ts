/**
 * Edge Function: decrypt-api-key
 *
 * Decrypts API keys server-side using AES-256-GCM with a server-managed
 * encryption key. The encryption key is stored as a Supabase secret and
 * never exposed to the client.
 *
 * Authentication: Requires valid Supabase JWT
 * Method: POST
 * Body: { encryptedKey: string }
 * Returns: { apiKey: string }
 *
 * SECURITY NOTE: This endpoint returns decrypted API keys. Consider:
 * - Rate limiting this endpoint
 * - Logging access for audit purposes
 * - Using short-lived tokens for additional security
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptApiKey, isEncryptionConfigured } from '../_shared/crypto.ts';
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
    const { encryptedKey } = await req.json();
    if (!encryptedKey || typeof encryptedKey !== 'string') {
      return errorResponse('Missing or invalid encryptedKey in request body');
    }

    // Decrypt the API key
    const apiKey = await decryptApiKey(encryptedKey, user.id);

    return jsonResponse({ apiKey });
  } catch (error) {
    console.error('Decryption error:', error);
    // Don't expose detailed error messages for security
    return errorResponse('Decryption failed', 500);
  }
});
