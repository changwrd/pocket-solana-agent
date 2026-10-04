const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@solana-mobile/mobile-wallet-adapter-protocol/encoding") {
    return context.resolveRequest(
      context,
      "@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/encoding.native.js",
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});
