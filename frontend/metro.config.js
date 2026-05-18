const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three.js and expo-three need .glsl/.vs/.fs support optional; we don't use external shaders
module.exports = config;
