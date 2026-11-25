import * as React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, layout } from '@/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  background?: string;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

/**
 * Real OS safe areas. The board draws a device bezel, Dynamic Island and home
 * indicator as presentation aids — those are never rendered by the app.
 */
export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['top', 'left', 'right'],
  background = colors.surface.base,
  style,
  contentStyle,
}: Props) {
  const inner: ViewStyle[] = [padded ? styles.padded : styles.flush, contentStyle ?? {}];
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: background }, style]}>
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[inner, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: layout.screenPadding },
  flush: { paddingHorizontal: 0 },
  scrollContent: { paddingBottom: 40, flexGrow: 1 },
});
