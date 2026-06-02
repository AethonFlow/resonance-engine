# 1. Den Zustand mit dem neuen Paket zu GitHub pushen
git add package.json yarn.lock
git commit - m "fix: append react-native-worklets for reanimated babel engine"
git push

# 2. Den EAS Cloud - Build frisch starten
eas build - p android--profile production
