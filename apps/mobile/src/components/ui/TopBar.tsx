import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { board, colors, icon, layout } from '@/theme';
import { Text } from './Text';

/** Board `.top` row: back chevron, small centred title, optional right slot. */
export function TopBar({ title, right, onBack }: { title?: string; right?: React.ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={layout.minTouchTarget / 4}
        // With no history (deep link, fresh launch) go to the app root; the session guard routes from there.
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={styles.side}
      >
        <ChevronLeft size={icon.xl} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
      </Pressable>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: board.topBar.height,
    marginBottom: board.topBar.marginBottom,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { minWidth: icon.xl, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { fontSize: board.topBar.fontSize, color: board.topBar.color },
});
