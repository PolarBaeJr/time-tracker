/**
 * OAuth Module
 *
 * Exports OAuth callback handling utilities for email and calendar integrations.
 */

export {
  handleOAuthCallback,
  detectOAuthCallbackType,
  isOAuthCallback,
  setupElectronOAuthListeners,
  processWebCallback,
  getStoredOAuthError,
  getStoredOAuthSuccess,
  type OAuthCallbackType,
  type OAuthCallbackResult,
  type StoredOAuthError,
  type StoredOAuthSuccess,
} from './callback';
