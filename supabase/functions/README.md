# Supabase Edge Functions

This directory contains Supabase Edge Functions for server-side operations.

## Functions

### `encrypt-api-key`
Encrypts API keys (e.g., Claude, OpenAI) before storing in the database.

### `decrypt-api-key`
Decrypts API keys when needed for AI provider initialization.

## Security Architecture

API keys are encrypted using AES-256-GCM with a server-managed encryption key:

1. **Master Key**: Stored as `ENCRYPTION_KEY` Supabase secret (never exposed to client)
2. **Per-User Derivation**: Each user gets a unique encryption key derived from the master key + their user ID using HKDF
3. **Transport**: API keys are sent over HTTPS to Edge Functions for encryption/decryption
4. **Storage**: Only encrypted keys are stored in the database

This ensures that even with database access, an attacker cannot decrypt API keys without the server-side master key.

## Setup

### 1. Generate Encryption Key

```bash
openssl rand -base64 32
```

### 2. Set as Supabase Secret

For local development:
```bash
supabase secrets set ENCRYPTION_KEY="your-generated-key"
```

For production (via Supabase Dashboard):
1. Go to Project Settings > Edge Functions > Secrets
2. Add `ENCRYPTION_KEY` with your generated key

### 3. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy encrypt-api-key
supabase functions deploy decrypt-api-key
```

## Local Development

To test functions locally:

```bash
# Start Supabase locally
supabase start

# Set local secrets
supabase secrets set ENCRYPTION_KEY="test-key-for-local-dev"

# Serve functions locally
supabase functions serve
```

## Migration from Client-Side Encryption

If you have existing API keys encrypted with the old client-side encryption:

1. Deploy the new Edge Functions with `ENCRYPTION_KEY` configured
2. Existing keys encrypted with client-side encryption will fail to decrypt
3. Users will need to re-enter their API keys (they will be re-encrypted server-side)

Alternatively, you can write a migration script that:
1. Decrypts keys using the old client-side method
2. Re-encrypts them using the new server-side method

## Testing

```bash
# Test encryption (requires valid auth token)
curl -X POST 'http://localhost:54321/functions/v1/encrypt-api-key' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"apiKey": "sk-test-key-123"}'

# Test decryption
curl -X POST 'http://localhost:54321/functions/v1/decrypt-api-key' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"encryptedKey": "BASE64_ENCRYPTED_VALUE"}'
```
