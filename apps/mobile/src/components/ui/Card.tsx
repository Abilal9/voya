import * as React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  tone?: 'raised' | 'accent' | 'flat';
  style?: ViewStyle;
};

export function Card({ children, onPress, padded = true, tone = 'raised', style }: Props) {
  const body = (
    <View style={[styles.card, TONES[tone], padded && styles.padded, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>
      {body}
    </Pressable>
  );
}

const TONES: Record<'raised' | 'accent' | 'flat', ViewStyle> = {
  raised: { backgroundColor: colors.surface.raised, ...shadow.card },
  accent: { backgroundColor: colors.surface.accent },
  flat: { backgroundColor: colors.surface.sunken },
};

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  padded: { padding: spacing.md },
});
