/**
 * Library utilities and configurations
 *
 * This module exports all library utilities including:
 * - Supabase client configuration
 * - Environment constants
 * - React Query client configuration
 */

// Supabase client and types
export { supabase, config, validateConfig } from './supabase';
export { storage, secureStorage } from './storage';
export {
  createActiveTimerSubscription,
  getReconnectDelayMs,
  isValidActiveTimerRealtimePayload,
  normalizeActiveTimerRealtimePayload,
} from './realtime';

// React Query client
export { queryClient, queryKeys, type QueryKeys } from './queryClient';

// AI Engine
export { aiEngine } from './ai';
export type {
  AIProvider,
  AIProviderType,
  AIProviderConfig,
  ChatMessage,
  AIOptions,
  AIResponse,
} from './ai';

// Deep linking
export {
  linking,
  linkingPrefixes,
  linkingConfig,
  parseOAuthCallbackUrl,
  isOAuthCallbackUrl,
} from './linking';
export type { RootStackParamList, LinkingConfig } from './linking';

export type {
  SupabaseClient,
  Session,
  User,
  AuthError,
  AuthChangeEvent,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from './supabase';
export type { SecureStorage, Storage } from './storage';
export type {
  ActiveTimerConnectionStatus,
  ActiveTimerRealtimeClient,
  ActiveTimerRealtimeEventType,
  ActiveTimerRealtimePayload,
  ActiveTimerSubscriptionHandle,
  CreateActiveTimerSubscriptionOptions,
} from './realtime';

// Email integration
export {
  // Constants
  GMAIL_CONFIG,
  OUTLOOK_EMAIL_CONFIG,
  IMAP_DEFAULTS,
  EMAIL_SYNC_CONFIG,
  // OAuth helpers
  generateCodeVerifier,
  generateCodeChallenge,
  buildGmailAuthorizeUrl,
  buildOutlookEmailAuthorizeUrl,
  exchangeGmailCodeForTokens,
  exchangeOutlookCodeForTokens,
  refreshGmailToken,
  refreshOutlookToken,
  gmailApiFetch,
  outlookApiFetch,
  // Gmail service
  GmailService,
  parseGmailMessage,
  // Outlook email service
  OutlookEmailService,
  parseOutlookMessage,
} from './email';

export type {
  GmailConfig,
  OutlookEmailConfig,
  ImapDefaults,
  EmailSyncConfig,
  OAuthTokens,
  GmailHeader,
  GmailMessage,
  GmailMessageList,
  GmailProfile,
  OutlookMessage,
  OutlookMessageList,
  ListMessagesOptions,
} from './email';

// Calendar integration
export {
  // Constants
  GOOGLE_CALENDAR_CONFIG,
  OUTLOOK_CALENDAR_CONFIG,
  CALENDAR_SYNC_CONFIG,
  // OAuth helpers
  buildGoogleCalendarAuthorizeUrl,
  buildOutlookCalendarAuthorizeUrl,
  exchangeGoogleCalendarCodeForTokens,
  exchangeOutlookCalendarCodeForTokens,
  refreshGoogleCalendarToken,
  refreshOutlookCalendarToken,
  googleCalendarApiFetch,
  outlookCalendarApiFetch,
  // Google Calendar service
  GoogleCalendarService,
  parseGoogleEvent,
  getDefaultDateRange,
  // Outlook Calendar service
  OutlookCalendarService,
  parseOutlookEvent,
} from './calendar';

export type {
  GoogleCalendarConfig,
  OutlookCalendarConfig,
  CalendarSyncConfig,
  GoogleDateTime,
  GoogleEvent,
  GoogleEventList,
  GoogleCalendar,
  GoogleCalendarList,
  OutlookCalendarEvent,
  OutlookEventList,
  OutlookCalendar,
  OutlookCalendarList,
  ListEventsOptions as CalendarListEventsOptions,
} from './calendar';

// OAuth callback handlers
export {
  handleOAuthCallback,
  detectOAuthCallbackType,
  isOAuthCallback,
  setupElectronOAuthListeners,
  processWebCallback,
} from './oauth';

export type { OAuthCallbackType, OAuthCallbackResult } from './oauth';

// Animation utilities
export {
  // Constants
  ANIMATION_DURATION,
  ANIMATION_EASING,
  ANIMATION_PRESETS,
  // Reduced motion
  getReducedMotionPreference,
  setReducedMotionPreference,
  // Animation functions
  fade,
  fadeIn,
  fadeOut,
  scale,
  scaleIn,
  scaleOut,
  slide,
  slideIn,
  slideOut,
  pulse,
  spring,
  shake,
  parallel,
  sequence,
  stagger,
  interpolateColor,
} from './animations';

export type {
  AnimationConfig,
  AnimationDuration,
  AnimationEasingName,
  EasingFunction,
  SlideDirection,
} from './animations';
