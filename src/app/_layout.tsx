import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initStorage } from '@/storage/posts';
import { useAutoSync } from '@/sync/useAutoSync';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SQLiteProvider databaseName="plenka.db" onInit={initStorage}>
          <ThemeProvider>
            <Navigation />
          </ThemeProvider>
        </SQLiteProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { scheme, colors } = useTheme();
  useAutoSync();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.ink, border: colors.line, primary: colors.accent },
      }}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
        <Stack.Screen
          name="post/[id]"
          options={({ route }) => ({
            title: '',
            animation: (route.params as { photo?: string } | undefined)?.photo ? 'none' : 'default',
          })}
        />
        <Stack.Screen name="viewer/[id]" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="map" options={{ title: 'Карта записей' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
