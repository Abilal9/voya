import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Button, Text } from '@/components/ui';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { board, colors, icon } from '@/theme';

const F = board.feedback;

/**
 * S06 Destructive confirmation: title, one line, a danger action and Cancel.
 * The action stays disabled while it runs, so it can't fire twice.
 */
export function ConfirmSheet({ visible, title, body, confirmLabel, onConfirm, onCancel, busy, cancelLabel = 'Cancel' }: {
  visible: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; cancelLabel?: string;
}) {
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text style={sheetText.title}>{title}</Text>
      <Text style={sheetText.body}>{body}</Text>
      <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={busy} disabled={busy} />
      <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
    </BottomSheet>
  );
}

/**
 * S07 Success popup / S09 Creation confirmation: a lavender check, a short
 * title and line, and what to do next. Shown only after the change is saved.
 */
export function SuccessSheet({ visible, title, body, primaryLabel, onPrimary, secondaryLabel, onSecondary, onClose }: {
  visible: boolean; title: string; body?: string; primaryLabel: string; onPrimary: () => void;
  secondaryLabel?: string; onSecondary?: () => void; onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.mark}>
        <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
      </View>
      <Text style={sheetText.title}>{title}</Text>
      {body ? <Text style={sheetText.body}>{body}</Text> : null}
      <Button label={primaryLabel} onPress={onPrimary} />
      {secondaryLabel && onSecondary ? <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: F.markSize, height: F.markSize, borderRadius: F.markRadius, backgroundColor: F.markBackground,
    alignItems: 'center', justifyContent: 'center', marginBottom: F.markMarginBottom,
  },
});
