import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Лента', tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} /> }}
      />
      <Tabs.Screen
        name="archive"
        options={{ title: 'Архив', tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} /> }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Камера',
          tabBarIcon: () => (
            <View style={styles.fab}>
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
      <Tabs.Screen
        name="settings"
        options={{ title: 'Настройки', tabBarIcon: ({ focused }) => <TabIcon name="sliders" focused={focused} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ name, focused }: { name: ComponentProps<typeof Feather>['name']; focused: boolean }) {
  return <Feather name={name} size={22} color={focused ? colors.ink : colors.faint} />;
}

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
