import * as React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { board, colors, spacing } from '@/theme';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  right?: React.ReactNode;
};

export function TextField({ label, error, hint, right, style, ...rest }: Props) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={board.field.placeholder}
          style={[styles.input, style]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {error ? (
        <Text style={[styles.helper, styles.error]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  // Board `.xp-label`: 12px muted, 7 above the field.
  label: { fontSize: board.field.labelSize, color: colors.text.secondary, marginBottom: board.field.labelMarginBottom },
  // Board `.xp-input`: warm grey well, 15 radius, 54 tall, no border.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: board.field.gap,
    minHeight: board.field.minHeight,
    borderRadius: board.field.radius,
    borderWidth: 1,
    borderColor: board.field.background,
    backgroundColor: board.field.background,
    paddingHorizontal: board.field.paddingX,
  },
  fieldFocused: { borderColor: colors.brand.lavender },
  fieldError: { borderColor: colors.status.danger },
  input: {
    flex: 1,
    fontSize: board.field.fontSize,
    color: colors.text.primary,
    paddingVertical: spacing.md - 1,
  },
  right: {},
  helper: { fontSize: board.field.errorSize, lineHeight: board.small.lineHeight, color: colors.text.secondary, marginTop: spacing.xxs },
  error: { color: colors.status.danger },
});
