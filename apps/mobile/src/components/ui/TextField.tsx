import * as React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
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
        <Text variant="caption" tone="secondary" style={styles.label}>
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
          placeholderTextColor={colors.text.tertiary}
          style={[styles.input, style]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  label: { marginLeft: spacing.xxs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.raised,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: { borderColor: colors.brand.violet },
  fieldError: { borderColor: colors.status.danger },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  right: { marginLeft: spacing.xs },
  helper: { marginLeft: spacing.xxs },
});
