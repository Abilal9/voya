import * as React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, House, Plus, User } from 'lucide-react-native';
import { TAB_BAR_HEIGHT, TabBar } from '@/components/navigation/TabBar';
import { board, colors, icon, shadow } from '@/theme';

/** Home | Explore | Profile, plus the floating peach create action. */
export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <House size={size} color={color} strokeWidth={icon.strokeWidth} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, size }) => (
              <Compass size={size} color={color} strokeWidth={icon.strokeWidth} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <User size={size} color={color} strokeWidth={icon.strokeWidth} />
            ),
          }}
        />
      </Tabs>

      {/* The board places the floating + on Home only. */}
      {pathname === '/' ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a plan"
        onPress={() => router.push('/create')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: TAB_BAR_HEIGHT + insets.bottom + board.fab.bottomAboveTabBar },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Plus size={icon.lg} color={colors.brand.plum} strokeWidth={2} />
      </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: board.fab.right,
    width: board.fab.size,
    height: board.fab.size,
    borderRadius: board.fab.size / 2,
    backgroundColor: colors.brand.peach,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
    ...Platform.select({ android: { elevation: 10 } }),
  },
});
