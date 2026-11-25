import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { board, colors } from '@/theme';
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
  labelStyle?: TextStyle;
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
  labelStyle,
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
          <Text style={[styles.label, { color: VARIANTS[variant].label }, labelStyle]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { container: ViewStyle; label: string; spinner: string }> = {
  // Board `.action`: peach with plum label.
  primary: {
    container: { backgroundColor: colors.brand.peach },
    label: colors.brand.plum,
    spinner: colors.brand.plum,
  },
  // Board `.action.secondary`: pale lavender with violet label.
  secondary: {
    container: { backgroundColor: board.action.secondaryBackground },
    label: colors.brand.violet,
    spinner: colors.brand.violet,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: colors.brand.violet,
    spinner: colors.brand.violet,
  },
  danger: {
    container: { backgroundColor: board.action.dangerBackground },
    label: board.action.dangerText,
    spinner: board.action.dangerText,
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: board.action.minHeight,
    paddingVertical: board.action.paddingY,
    paddingHorizontal: board.action.paddingX,
    borderRadius: board.action.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  label: { fontSize: board.action.fontSize, fontWeight: board.action.fontWeight },
  row: { flexDirection: 'row', alignItems: 'center', gap: board.form.social.iconGap },
  icon: { alignItems: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
