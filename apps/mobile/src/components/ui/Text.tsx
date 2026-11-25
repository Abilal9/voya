import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, typography, type TypographyKey } from '@/theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'violet' | 'danger';

const TONES: Record<Tone, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  tertiary: colors.text.tertiary,
  inverse: colors.text.inverse,
  violet: colors.brand.violet,
  danger: colors.status.danger,
};

export type TextProps = RNTextProps & {
  variant?: TypographyKey;
  tone?: Tone;
  center?: boolean;
  weight?: TextStyle['fontWeight'];
};

export function Text({
  variant = 'body',
  tone = 'primary',
  center,
  weight,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: TONES[tone] },
        center && { textAlign: 'center' },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}
