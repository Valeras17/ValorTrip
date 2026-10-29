const { withProjectBuildGradle, withGradleProperties, withAndroidManifest } = require('@expo/config-plugins');

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

  // 3. Ensure Google ML Kit vision dependencies merge without conflict (expo-camera: barcode_ui, receipt-scanner: document_ui,ocr)
  config = withAndroidManifest(config, (mod) => {
    const mainApp = mod.modResults.manifest.application?.[0];
    if (mainApp) {
      if (!mainApp['meta-data']) {
        mainApp['meta-data'] = [];
      }
      const existing = mainApp['meta-data'].find(
        (m) => m.$?.['android:name'] === 'com.google.mlkit.vision.DEPENDENCIES'
      );
      if (existing) {
        existing.$['android:value'] = 'barcode_ui,document_ui,ocr';
        existing.$['tools:replace'] = 'android:value';
      } else {
        mainApp['meta-data'].push({
          $: {
            'android:name': 'com.google.mlkit.vision.DEPENDENCIES',
            'android:value': 'barcode_ui,document_ui,ocr',
            'tools:replace': 'android:value',
          },
        });
      }
    }
    return mod;
  });

  return config;
}

module.exports = withBuildConfig;
