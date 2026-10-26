import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';

import { colors } from '@/theme';

type IconProps = { color: ColorValue; size: number; focused: boolean };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="hole"
        options={{
          title: 'Hole',
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <Ionicons name={focused ? 'flag' : 'flag-outline'} color={color as string} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="scorecard"
        options={{
          title: 'Scorecard',
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <Ionicons name={focused ? 'reader' : 'reader-outline'} color={color as string} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="bag"
        options={{
          title: 'My Bag',
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <Ionicons name={focused ? 'golf' : 'golf-outline'} color={color as string} size={size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }: IconProps) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
