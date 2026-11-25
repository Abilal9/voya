import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoyaLogo } from '@/components/brand';
import { Button, Screen, Text } from '@/components/ui';
import { board, colors } from '@/theme';

const W = board.welcome;

/**
 * A01 Welcome — board figure "A01".
 * Full lockup, sized to the same height the emblem had (owner direction).
 */
export default function Welcome() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <VoyaLogo width={W.emblemSize * board.emblemAspect * board.logoAspect} />
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
