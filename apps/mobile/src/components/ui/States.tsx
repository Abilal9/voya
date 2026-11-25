import * as React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CloudOff, Compass, TriangleAlert } from 'lucide-react-native';
import { colors, icon, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/** S01–S05 in the frozen design. One component family, five intents. */

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.frame}>{children}</View>;
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <Frame>
      <ActivityIndicator color={colors.brand.violet} />
      <Text variant="footnote" tone="secondary" center>
        {label}
      </Text>
    </Frame>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Frame>
      <Compass size={icon.xl} color={colors.text.tertiary} strokeWidth={icon.strokeWidth} />
      <Text variant="title" center>
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="secondary" center>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} full={false} variant="secondary" />
      ) : null}
    </Frame>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <Frame>
      <TriangleAlert size={icon.xl} color={colors.status.danger} strokeWidth={icon.strokeWidth} />
      <Text variant="title" center>
        Something went wrong
      </Text>
      <Text variant="body" tone="secondary" center>
        {message ?? 'Please try again.'}
      </Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} full={false} variant="secondary" /> : null}
    </Frame>
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Frame>
      <CloudOff size={icon.xl} color={colors.text.tertiary} strokeWidth={icon.strokeWidth} />
      <Text variant="title" center>
        You&apos;re offline
      </Text>
      <Text variant="body" tone="secondary" center>
        Check your connection and try again.
      </Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} full={false} variant="secondary" /> : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
