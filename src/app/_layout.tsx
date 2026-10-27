import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initStorage } from '@/storage/posts';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="plenka.db" onInit={initStorage}>
        <ThemeProvider>
          <Navigation />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.ink, border: colors.line, primary: colors.accent },
      }}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationBar style={scheme === 'dark' ? 'dark' : 'light'} />
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
        <Stack.Screen name="viewer/[id]" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="map" options={{ title: 'Карта записей' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
