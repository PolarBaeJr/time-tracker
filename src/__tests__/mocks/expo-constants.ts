const Constants = {
  expoConfig: {
    name: 'WorkTracker',
    slug: 'worktracker',
    extra: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key-that-is-long-enough-to-pass-validation-checks-yes',
    },
  },
  manifest: null,
  appOwnership: null,
  platform: { ios: undefined, android: undefined, web: undefined },
  isDevice: false,
  sessionId: 'test-session-id',
  statusBarHeight: 0,
};

export default Constants;
