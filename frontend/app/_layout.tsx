import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { View } from 'react-native';
import { COLORS } from '../src/design';
import { SettingsProvider } from '../src/i18n';
import { OnboardingOverlay } from '../src/Onboarding';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.void }} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.void }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.void },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="orbit" options={{ title: 'TheOrbit' }} />
          </Stack>
          <OnboardingOverlay />
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
