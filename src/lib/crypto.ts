/**
 * Client-side Encryption Interface
 *
 * Provides a client-side interface for server-side encryption of sensitive data.
 * All actual encryption/decryption happens on the server via Supabase Edge Functions.
 *
 * Security approach:
 * - Encryption key is stored ONLY on the server (as a Supabase secret)
 * - Client sends plaintext API keys to the encrypt endpoint over HTTPS
 * - Server encrypts with AES-256-GCM using a key derived from:
 *   - A master secret (ENCRYPTION_KEY env var on server)
 *   - The user's ID (for per-user key isolation)
 * - Encrypted keys are stored in the database
 * - Decryption requires valid authentication to the server
 *
 * This approach ensures:
 * - Database breaches don't expose API keys (attacker needs server secret)
 * - Client code inspection doesn't reveal encryption keys
 * - Per-user key derivation provides isolation between users
 *
 * Setup:
 * 1. Generate encryption key: openssl rand -base64 32
 * 2. Set as Supabase secret: supabase secrets set ENCRYPTION_KEY="your-key"
 * 3. Deploy edge functions: supabase functions deploy
 */

import { supabase } from './supabase';

/**
 * Get the functions URL from Supabase client
 */
function getFunctionsUrl(): string {
  // The Supabase URL format is: https://<project-ref>.supabase.co
  // Functions URL is: https://<project-ref>.supabase.co/functions/v1
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/functions/v1`;
}

/**
 * Encrypt an API key using server-side encryption.
 *
 * @param plaintext - The API key to encrypt
 * @param _userId - The user's ID (kept for API compatibility, but auth is via session)
 * @returns Base64-encoded encrypted data
 * @throws Error if encryption fails or user is not authenticated
 */
export async function encryptApiKey(plaintext: string, _userId: string): Promise<string> {
  // Get current session for auth header
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Not authenticated - cannot encrypt API key');
  }

  const response = await fetch(`${getFunctionsUrl()}/encrypt-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ apiKey: plaintext }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Encryption failed with status ${response.status}`);
  }

  const { encryptedKey } = await response.json();
  return encryptedKey;
}

/**
 * Decrypt an encrypted API key using server-side decryption.
 *
 * @param encryptedData - Base64-encoded encrypted data from encryptApiKey
 * @param _userId - The user's ID (kept for API compatibility, but auth is via session)
 * @returns The decrypted plaintext API key
 * @throws Error if decryption fails or user is not authenticated
 */
export async function decryptApiKey(encryptedData: string, _userId: string): Promise<string> {
  // Get current session for auth header
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Not authenticated - cannot decrypt API key');
  }

  const response = await fetch(`${getFunctionsUrl()}/decrypt-api-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ encryptedKey: encryptedData }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Decryption failed with status ${response.status}`);
  }

  const { apiKey } = await response.json();
  return apiKey;
}

/**
 * Check if a value appears to be encrypted (base64-encoded with proper structure).
 * Used to handle migration from plaintext to encrypted storage.
 *
 * Note: This is a heuristic check. Server-side encrypted values follow the same
 * format as the previous client-side encryption (IV + ciphertext in base64).
 */
export function isEncrypted(value: string): boolean {
  // Encrypted values are base64 and have minimum length (12 bytes IV + some ciphertext)
  if (value.length < 20) return false;
  try {
    const decoded = atob(value);
    // Must be at least 12 bytes (IV) + 1 byte (min ciphertext)
    return decoded.length >= 13;
  } catch {
    // Not valid base64
    return false;
  }
}
