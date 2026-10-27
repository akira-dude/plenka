const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withFragileUserData(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$['android:hasFragileUserData'] = 'true';
    return mod;
  });
};
