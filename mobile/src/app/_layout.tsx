import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider } from '../lib/session';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: '로그인', headerBackVisible: false }} />
        <Stack.Screen name="home" options={{ title: 'Sports Grow', headerBackVisible: false }} />
        <Stack.Screen name="records" options={{ title: '기록' }} />
        <Stack.Screen name="reports" options={{ title: '리포트' }} />
      </Stack>
    </SessionProvider>
  );
}
