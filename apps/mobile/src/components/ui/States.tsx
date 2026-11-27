import * as React from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, MapPin, Wifi, X, type LucideIcon } from 'lucide-react-native';
import { ServiceError } from '@/services/types';
import { board, colors, icon } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

const S = board.stateHero;
const SK = board.skeleton;

/**
 * S01–S05 in the frozen design: one component family. The board's `.xp-state`
 * is a lavender symbol, a large title and a short line, with its actions
 * below. These render inside an existing screen (its top bar stays).
 */
function StateFrame({ Icon, title, body, primary, secondary }: {
  Icon: LucideIcon; title: string; body?: string;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.frame} accessibilityRole="summary">
      <View style={styles.symbol}>
        <Icon size={S.symbolIcon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {primary || secondary ? (
        <View style={styles.actions}>
          {primary ? <Button label={primary.label} onPress={primary.onPress} /> : null}
          {secondary ? <Button label={secondary.label} variant="ghost" onPress={secondary.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * S01 Loading: the board's skeleton (title line, image block, text lines).
 * `compact` is a small spinner for loads inside sheets and short lists.
 */
export function LoadingState({ label = 'Loading', compact }: { label?: string; compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.compact} accessibilityRole="progressbar" accessibilityLabel={label}>
        <ActivityIndicator color={colors.brand.violet} />
      </View>
    );
  }
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <View style={[styles.bone, styles.small, { width: SK.titleWidth }]} />
      <View style={[styles.bone, styles.image]} />
      <View style={[styles.bone, styles.line]} />
      <View style={[styles.bone, styles.small]} />
      <View style={[styles.bone, styles.small, { width: SK.shortWidth }]} />
    </View>
  );
}

/** S02 Empty. An action shows only when it does something. */
export function EmptyState({ title, body, actionLabel, onAction, secondaryLabel, onSecondary, icon: Icon = CalendarDays }: {
  title: string; body?: string; actionLabel?: string; onAction?: () => void;
  secondaryLabel?: string; onSecondary?: () => void; icon?: LucideIcon;
}) {
  return (
    <StateFrame
      Icon={Icon} title={title} body={body}
      primary={actionLabel && onAction ? { label: actionLabel, onPress: onAction } : undefined}
      secondary={secondaryLabel && onSecondary ? { label: secondaryLabel, onPress: onSecondary } : undefined}
    />
  );
}

/**
 * S03 Error, with "Try again" and "Go back". A mock-service "offline" error
 * shows S04 instead. Internal messages are never shown; `message` is for
 * written, user-facing copy only.
 */
export function ErrorState({ onRetry, message, error, title }: { onRetry?: () => void; message?: string; error?: unknown; title?: string }) {
  const router = useRouter();
  if (error instanceof ServiceError && error.code === 'offline') return <OfflineState onRetry={onRetry} />;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <StateFrame
      Icon={X} title={title ?? 'Something\nwent wrong'} body={message ?? 'We couldn’t load this right now.'}
      primary={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
      secondary={{ label: 'Go back', onPress: back }}
    />
  );
}

/**
 * S04 Offline. In this preview Voya has no server, so this appears only when
 * the developer menu simulates it; saved plans stay on the phone.
 */
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateFrame
      Icon={Wifi} title="You’re offline" body="Some parts of Voya need a connection. Your saved Plans are still here."
      primary={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
    />
  );
}

/** S05 Permission denied, with the system Settings page as the way back. */
export function PermissionState({ title = 'Location is off', body = 'Turn on location in Settings to discover what’s nearby.', onNotNow, icon: Icon = MapPin }: {
  title?: string; body?: string; onNotNow?: () => void; icon?: LucideIcon;
}) {
  return (
    <StateFrame
      Icon={Icon} title={title} body={body}
      primary={{ label: 'Open Settings', onPress: () => void Linking.openSettings() }}
      secondary={onNotNow ? { label: 'Not now', onPress: onNotNow } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  frame: { flexGrow: 1, justifyContent: 'center', paddingTop: S.paddingTop, paddingBottom: S.paddingBottom },
  symbol: {
    width: S.symbolSize, height: S.symbolSize, borderRadius: S.symbolRadius, backgroundColor: S.symbolBackground,
    alignItems: 'center', justifyContent: 'center', marginBottom: S.symbolMarginBottom,
  },
  title: { ...board.h1, color: colors.brand.plum, marginBottom: board.inlineGap },
  body: { fontSize: S.bodySize, lineHeight: S.bodyLineHeight, color: colors.text.secondary, maxWidth: S.bodyMaxWidth },
  actions: { marginTop: S.actionsMarginTop },
  compact: { paddingVertical: board.listRow.paddingY, alignItems: 'center' },
  skeleton: { flexGrow: 1, paddingTop: board.inlineGap },
  bone: { backgroundColor: SK.color, borderRadius: SK.radius, marginBottom: SK.gap },
  small: { height: SK.smallHeight, width: SK.smallWidth },
  line: { height: SK.lineHeight, width: SK.lineWidth },
  image: { height: SK.imageHeight, borderRadius: SK.imageRadius, marginVertical: SK.imageMarginY },
});
