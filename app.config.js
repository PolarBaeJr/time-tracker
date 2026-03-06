const appJson = require('./app.json');

const expoConfig = appJson.expo;

module.exports = () => {
  const googleIosReversedClientId =
    process.env.GOOGLE_IOS_REVERSED_CLIENT_ID ||
    expoConfig.ios?.infoPlist?.CFBundleURLTypes?.[0]?.CFBundleURLSchemes?.[0] ||
    'com.googleusercontent.apps.YOUR_IOS_REVERSED_CLIENT_ID';

  const easProjectId =
    process.env.EAS_PROJECT_ID || expoConfig.extra?.eas?.projectId || 'your-project-id';

  return {
    ...expoConfig,
    ios: {
      ...expoConfig.ios,
      infoPlist: {
        ...expoConfig.ios?.infoPlist,
        CFBundleURLTypes: [
          {
            CFBundleURLName: 'google-signin',
            CFBundleURLSchemes: [googleIosReversedClientId],
          },
        ],
      },
    },
    extra: {
      ...expoConfig.extra,
      eas: {
        ...expoConfig.extra?.eas,
        projectId: easProjectId,
      },
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    },
  };
};
