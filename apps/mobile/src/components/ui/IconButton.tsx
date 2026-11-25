import * as React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, layout, radius } from '@/theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
  tone?: 'plain' | 'surface';
  style?: ViewStyle;
};

export function IconButton({ children, onPress, label, tone = 'plain', style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone === 'surface' && styles.surface,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  surface: { backgroundColor: colors.surface.raised },
});
