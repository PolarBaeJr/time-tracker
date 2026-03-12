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
  type OAuthCallbackType,
  type OAuthCallbackResult,
} from './callback';
