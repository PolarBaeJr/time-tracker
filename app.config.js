const appJson = require('./app.json');
const packageJson = require('./package.json');

const expoConfig = appJson.expo;

// Compute versionCode from semver: major*10000 + minor*100 + patch
// e.g. 1.1.10 → 10110, 1.2.0 → 10200, 2.0.0 → 20000
function computeVersionCode(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return major * 10000 + minor * 100 + patch;
}

module.exports = () => {
  const version = packageJson.version;
  const versionCode = computeVersionCode(version);

  const googleIosReversedClientId =
    process.env.GOOGLE_IOS_REVERSED_CLIENT_ID ||
    expoConfig.ios?.infoPlist?.CFBundleURLTypes?.[0]?.CFBundleURLSchemes?.[0] ||
    'com.googleusercontent.apps.YOUR_IOS_REVERSED_CLIENT_ID';

  const easProjectId =
    process.env.EAS_PROJECT_ID || expoConfig.extra?.eas?.projectId || '29ee1370-b8ab-4bd3-9cd7-3da465732d29';

  return {
    ...expoConfig,
    version,
    android: {
      ...expoConfig.android,
      versionCode,
    },
    ios: {
      ...expoConfig.ios,
      buildNumber: String(versionCode),
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
