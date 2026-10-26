import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { KeyboardBarHost } from '@/components/KeyboardBar';
import { StoreProvider } from '@/state/store';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <KeyboardBarHost>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-round" options={{ presentation: 'modal' }} />
        </Stack>
      </KeyboardBarHost>
    </StoreProvider>
  );
}
