import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoyaEmblem } from '@/components/brand';
import { Button, Screen, Text } from '@/components/ui';
import { board, colors } from '@/theme';

const W = board.welcome;

/**
 * A01 Welcome — board figure "A01".
 * The board shows the full lockup here; per the owner's direction the app uses
 * the emblem alone everywhere except the native splash.
 */
export default function Welcome() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <VoyaEmblem size={W.emblemSize} />
        </View>
        <Text style={styles.title}>{'Plan less.\nLive more.'}</Text>
        <Text style={styles.body}>Trips, hangouts and events — beautifully planned together.</Text>
      </View>
      <View style={styles.foot}>
        <Button label="Create account" onPress={() => router.push('/(auth)/sign-up')} />
        <Button label="Sign in" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: board.screenPaddingX },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: W.paddingBottom },
  mark: { marginBottom: W.logoMarginBottom },
  title: {
    fontSize: W.titleSize, lineHeight: W.titleLineHeight, fontWeight: '700',
    letterSpacing: board.h1.letterSpacing, color: colors.brand.plum, marginBottom: board.h1.marginBottom,
  },
  body: { fontSize: W.bodySize, lineHeight: W.bodyLineHeight, color: colors.text.secondary, maxWidth: W.bodyMaxWidth },
  foot: { gap: board.action.marginTop - 1, paddingBottom: board.listRow.paddingY },
});
