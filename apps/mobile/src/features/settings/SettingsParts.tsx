import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { board, colors, icon } from '@/theme';

const S = board.settings;

/**
 * Board `.xp-row`. A row with no `onPress` is informational: it shows no
 * chevron, so nothing looks tappable that is not.
 */
export function SettingsRow({ title, subtitle, onPress, danger, right }: {
  title: string; subtitle?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode;
}) {
  const tone = danger ? S.danger : colors.brand.plum;
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: tone }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, danger && { color: S.danger }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={S.row.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null)}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} onPress={onPress} style={styles.row}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} style={styles.row}>{body}</View>
  );
}

/** Board `.xp-switch`. */
export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={board.inlineGap}
      style={[styles.switch, value && styles.switchOn]}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

/** Board `.xp-toggle-row`: a title and a persisted switch. */
export function ToggleRow({ title, value, onChange }: { title: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.row, styles.toggleRow]}>
      <Text style={[styles.title, styles.rowText]}>{title}</Text>
      <Switch value={value} onChange={onChange} label={title} />
    </View>
  );
}

/** Board `.xp-group` section label. */
export function GroupLabel({ children }: { children: string }) {
  return <Text style={styles.group}>{children.toUpperCase()}</Text>;
}

/** Board `.xp-sheet`: bottom sheet over a dimmed screen (V09 and confirmations). */
export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        {children}
      </SafeAreaView>
    </Modal>
  );
}

export const sheetText = StyleSheet.create({
  title: { fontSize: S.sheet.titleSize, lineHeight: S.sheet.titleLineHeight, fontWeight: '700', color: colors.brand.plum, marginBottom: board.listRow.paddingY },
  body: { fontSize: S.sheet.bodySize, lineHeight: S.sheet.bodyLineHeight, color: colors.text.secondary, marginBottom: board.action.marginTop },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.row.gap, minHeight: S.row.minHeight,
    paddingVertical: S.row.paddingY, borderBottomWidth: 1, borderBottomColor: S.row.border,
  },
  toggleRow: { minHeight: S.toggleRow.minHeight, paddingVertical: S.toggleRow.paddingY },
  rowText: { flex: 1, minWidth: 0 },
  title: { fontSize: S.row.titleSize, lineHeight: S.row.titleLineHeight, fontWeight: '500', color: colors.brand.plum },
  subtitle: { fontSize: S.row.subtitleSize, lineHeight: board.small.lineHeight, color: colors.text.secondary, marginTop: S.row.subtitleMarginTop },
  switch: { width: S.switch.width, height: S.switch.height, borderRadius: S.switch.height / 2, backgroundColor: S.switch.off, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.brand.violet },
  knob: { width: S.switch.knob, height: S.switch.knob, borderRadius: S.switch.knob / 2, backgroundColor: colors.surface.base, marginLeft: S.switch.inset },
  knobOn: { marginLeft: S.switch.width - S.switch.knob - S.switch.inset },
  group: {
    fontSize: board.search.group.fontSize, letterSpacing: board.search.group.tracking, color: board.search.group.color,
    marginTop: board.search.group.marginTop, marginBottom: board.search.group.marginBottom,
  },
  scrim: { flex: 1, backgroundColor: S.sheet.scrim },
  sheet: {
    backgroundColor: colors.surface.base, borderTopLeftRadius: S.sheet.radius, borderTopRightRadius: S.sheet.radius,
    paddingHorizontal: S.sheet.paddingX, paddingTop: S.sheet.paddingTop, paddingBottom: S.sheet.paddingBottom, ...board.sheetShadow,
  },
  handle: {
    width: board.filters.handle.width, height: board.filters.handle.height, borderRadius: board.filters.handle.radius,
    backgroundColor: board.filters.handle.color, alignSelf: 'center', marginBottom: board.filters.handle.marginBottom,
  },
});
