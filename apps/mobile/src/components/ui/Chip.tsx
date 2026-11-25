import * as React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text variant="footnote" style={{ color: selected ? colors.text.onViolet : colors.text.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.brand.violet },
  unselected: {
    backgroundColor: colors.surface.raised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
});
