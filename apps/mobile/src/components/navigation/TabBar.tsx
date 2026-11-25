import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { board, colors, icon } from '@/theme';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const bar = board.tabBar;

/** Visible bar height above the home-indicator inset (board: 88 − 24 bottom padding). */
export const TAB_BAR_HEIGHT = bar.height - bar.paddingBottom;

/** Board bottom navigation: cream bar, lavender pill behind the active item. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key]!;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const color = focused ? colors.brand.violet : bar.inactive;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={[styles.item, focused && styles.itemActive]}
          >
            {options.tabBarIcon?.({ focused, color, size: bar.iconSize })}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: bar.paddingX,
    paddingTop: bar.paddingTop,
    backgroundColor: colors.surface.base,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: bar.borderColor,
  },
  item: {
    minWidth: bar.itemMinWidth,
    minHeight: bar.itemMinHeight,
    borderRadius: bar.itemRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: bar.itemGap,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  itemActive: { backgroundColor: bar.activeBackground },
  label: { fontSize: bar.labelSize, lineHeight: icon.sm },
});
