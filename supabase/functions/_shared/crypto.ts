/**
 * Server-side Encryption Utilities
 *
 * Provides secure encryption/decryption for sensitive data like API keys.
 * Uses AES-256-GCM with a server-side encryption key stored as a Supabase secret.
 *
 * Security approach:
 * - Encryption key is stored as ENCRYPTION_KEY environment variable (Supabase secret)
 * - Key is NEVER exposed to the client
 * - Uses per-user key derivation for additional isolation
 * - AES-256-GCM provides authenticated encryption
 *
 * Setup:
 * 1. Generate a secure key: openssl rand -base64 32
 * 2. Set as Supabase secret: supabase secrets set ENCRYPTION_KEY="your-base64-key"
 */

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');

if (!ENCRYPTION_KEY) {
  console.error(
    'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: openssl rand -base64 32 ' +
      'Then set it with: supabase secrets set ENCRYPTION_KEY="your-key"'
  );
}

/**
 * Derive a per-user encryption key from the master key and user ID.
 * This provides additional isolation - even with the master key,
 * you need to know the user ID to decrypt their data.
 */
async function deriveUserKey(userId: string): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY) {
    throw new Error('Server encryption key not configured');
  }

  const encoder = new TextEncoder();

  // Import the master key as key material for HKDF
  const masterKeyMaterial = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(ENCRYPTION_KEY), c => c.charCodeAt(0)),
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive a unique key for this user using HKDF
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(userId),
      info: encoder.encode('api-key-encryption'),
    },
    masterKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-GCM with per-user key derivation.
 * Returns a base64-encoded string containing the IV + ciphertext.
 *
 * @param plaintext - The text to encrypt (e.g., an API key)
 * @param userId - The user's unique ID (used for key derivation)
 * @returns Base64-encoded encrypted data (IV + ciphertext)
 */
export async function encryptApiKey(plaintext: string, userId: string): Promise<string> {
  const key = await deriveUserKey(userId);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate a random 12-byte IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  // Prepend IV to ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64 for safe storage in database
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an encrypted API key.
 *
 * @param encryptedData - Base64-encoded encrypted data from encryptApiKey
 * @param userId - The user's unique ID (used for key derivation)
 * @returns The decrypted plaintext
 */
export async function decryptApiKey(encryptedData: string, userId: string): Promise<string> {
  const key = await deriveUserKey(userId);

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if the encryption key is properly configured.
 */
export function isEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32;
}
