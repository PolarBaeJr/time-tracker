const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = function forceBouncyCastleVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Force exact bouncycastle version so Gradle doesn't need to list versions
    // from JitPack (which times out). The version range [1.81,1.82) triggers
    // a metadata fetch from all repos including JitPack.
    const forceBlock = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'org.bouncycastle:bcprov-jdk15to18:1.81'
            force 'org.bouncycastle:bcutil-jdk15to18:1.81'
            force 'org.bouncycastle:bcpkix-jdk15to18:1.81'
        }
    }
}
`;

    if (!contents.includes('force \'org.bouncycastle')) {
      config.modResults.contents = contents + forceBlock;
    }

    return config;
  });
};
