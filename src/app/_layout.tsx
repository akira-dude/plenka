import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { initStorage } from '@/storage/posts';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="plenka.db" onInit={initStorage}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="compose" options={{ title: 'Новая запись' }} />
        <Stack.Screen name="post/[id]" options={{ title: '' }} />
      </Stack>
    </SQLiteProvider>
  );
}
