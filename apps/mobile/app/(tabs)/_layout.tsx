import * as React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, House, Plus, User } from 'lucide-react-native';
import { colors, icon, shadow } from '@/theme';

/** Home | Explore | Profile, plus the floating peach create action. */
export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand.violet,
          tabBarInactiveTintColor: colors.text.tertiary,
          tabBarStyle: {
            backgroundColor: colors.surface.raised,
            borderTopColor: colors.border.subtle,
            height: 60 + insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <House size={icon.lg} color={color} strokeWidth={icon.strokeWidth} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => (
              <Compass size={icon.lg} color={color} strokeWidth={icon.strokeWidth} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <User size={icon.lg} color={color} strokeWidth={icon.strokeWidth} />
            ),
          }}
        />
      </Tabs>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a plan"
        onPress={() => router.push('/create')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: 60 + insets.bottom + 18 },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Plus size={26} color={colors.brand.plum} strokeWidth={2} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brand.peach,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
    ...Platform.select({ android: { elevation: 10 } }),
  },
});
