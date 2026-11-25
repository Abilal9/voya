import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
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

export function AvatarStack({ names, size = 28, max = 4 }: { names: string[]; size?: number; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((n, i) => (
        <Avatar
          key={n}
          name={n}
          size={size}
          style={{
            marginLeft: i === 0 ? 0 : -size / 3,
            borderWidth: 2,
            borderColor: colors.surface.base,
          }}
        />
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.base,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size / 3,
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
});
