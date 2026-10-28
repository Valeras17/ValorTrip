const { withProjectBuildGradle, withGradleProperties } = require('@expo/config-plugins');

function withBuildConfig(config) {
  // 1. Remove deprecated global property if present
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter(
      (item) => item.key !== 'android.defaults.buildfeatures.buildconfig'
    );
    return mod;
  });

  // 2. Safely configure buildFeatures.buildConfig for all Android subprojects using plugins.withId (reactive, no afterEvaluate)
  config = withProjectBuildGradle(config, (mod) => {
    const subprojectsBlock = `
subprojects {
    plugins.withId("com.android.library") {
        android {
            buildFeatures {
                buildConfig = true
            }
        }
    }
    plugins.withId("com.android.application") {
        android {
            buildFeatures {
                buildConfig = true
            }
        }
    }
}
`;
    if (!mod.modResults.contents.includes('plugins.withId("com.android.library")')) {
      mod.modResults.contents += subprojectsBlock;
    }
    return mod;
  });

  return config;
}

module.exports = withBuildConfig;
