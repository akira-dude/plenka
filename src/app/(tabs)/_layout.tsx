import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarButtonProps } from 'expo-router/tabs';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '@/ui/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const icon = (name: ComponentProps<typeof Feather>['name']) =>
    function TabIcon({ focused }: { focused: boolean }) {
      return <Feather name={name} size={22} color={focused ? colors.ink : colors.faint} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarButton: TabButton,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Лента', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="archive" options={{ title: 'Архив', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Камера',
          tabBarIcon: () => (
            <View style={[styles.fab, { backgroundColor: colors.accent }]}>
              <Feather name="camera" size={20} color={colors.onAccent} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push({ pathname: '/compose', params: { source: 'camera' } });
          },
        }}
      />
      <Tabs.Screen name="search" options={{ title: 'Поиск', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="settings" options={{ title: 'Настройки', tabBarIcon: icon('sliders') }} />
    </Tabs>
  );
}

function TabButton({ children, onPress, onLongPress, style, accessibilityState, accessibilityLabel, testID }: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={onPress as PressableProps['onPress']}
      onLongPress={onLongPress}
      style={[style, styles.button]}
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
