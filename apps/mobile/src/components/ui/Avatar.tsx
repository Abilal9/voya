import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { board, colors, radius } from '@/theme';
import { Text } from './Text';

const TINTS = ['#CEBDF3', '#FFC87A', '#E6DBE3', '#D9DFC7', '#EDE2F7'] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic tint so a person looks the same on every screen. */
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length] as string;
}

export function Avatar({ name, size = 40, style }: { name: string; size?: number; style?: ViewStyle }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tintFor(name) },
        style,
      ]}
    >
      <Text variant={size >= 40 ? 'footnote' : 'caption'} weight="700">
        {initials(name)}
      </Text>
    </View>
  );
}

/** Board stack tint: lavender by default, peach on every 2nd, sage on every 3rd (CSS nth-child). */
function stackTint(i: number) {
  const n = i + 1;
  const [lavender, peach, sage] = board.avatar.tints;
  if (n % 3 === 0) return sage;
  if (n % 2 === 0) return peach;
  return lavender;
}

/** Board avatar stack: 36pt circles, 2pt cream ring, 7pt overlap, 11pt semibold initials. */
export function AvatarStack({
  names, size = board.avatar.size, max = 4,
}: { names: string[]; size?: number; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((n, i) => (
        <View
          key={n}
          accessibilityRole="image"
          accessibilityLabel={n}
          style={[
            styles.base,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: stackTint(i),
              marginLeft: i === 0 ? 0 : board.avatar.overlap,
              borderWidth: board.avatar.border,
              borderColor: colors.surface.base,
            },
          ]}
        >
          <Text style={styles.stackInitials}>{initials(n)}</Text>
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.base,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: board.avatar.overlap,
              backgroundColor: colors.surface.sunken,
              borderWidth: 2,
              borderColor: colors.surface.base,
            },
          ]}
        >
          <Text variant="caption" tone="secondary">{`+${extra}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackInitials: {
    fontSize: board.avatar.fontSize,
    fontWeight: board.avatar.fontWeight,
    color: colors.text.primary,
  },
});
