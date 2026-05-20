const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// three.js und expo-three brauchen keine extra Shader-Konfiguration,
// daher exportieren wir einfach die Standard-Konfiguration.
module.exports = config;
