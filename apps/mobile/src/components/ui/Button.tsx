import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, layout, radius, spacing } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  full = true,
  icon,
  style,
  testID,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        VARIANTS[variant].container,
        full && styles.full,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={VARIANTS[variant].spinner} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text variant="subtitle" style={{ color: VARIANTS[variant].label }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { container: ViewStyle; label: string; spinner: string }> = {
  primary: {
    container: { backgroundColor: colors.brand.violet },
    label: colors.text.onViolet,
    spinner: colors.text.onViolet,
  },
  secondary: {
    container: {
      backgroundColor: colors.surface.raised,
      borderWidth: 1,
      borderColor: colors.border.strong,
    },
    label: colors.text.primary,
    spinner: colors.text.primary,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: colors.brand.violet,
    spinner: colors.brand.violet,
  },
  danger: {
    container: { backgroundColor: colors.status.dangerSurface },
    label: colors.status.danger,
    spinner: colors.status.danger,
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  icon: { minWidth: layout.minTouchTarget / 2 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
