import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Text } from '@/components/ui';
import type { Place } from '@/services';
import { colors, icon, radius, shadow, spacing } from '@/theme';

const PHOTO_TINT: Record<string, string> = {
  restaurant: '#E6DBE3',
  activity: '#D9DFC7',
  uffizi: '#F0DFE1',
  florence: '#EDE2F7',
  wedding: '#FFE9D2',
};

/**
 * E01 discovery card. Rating, price and photo are all OPTIONAL — roughly a
 * third of the fixtures omit them on purpose, because provider data does.
 */
export function PlaceCard({ place }: { place: Place }) {
  const tint = PHOTO_TINT[place.photo ?? ''] ?? colors.surface.sunken;
  return (
    <View style={styles.card}>
      <View style={[styles.photo, { backgroundColor: tint }]}>
        {!place.photo ? (
          <Text variant="caption" tone="tertiary">No photo available</Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text variant="h2" numberOfLines={2}>{place.name}</Text>
        {place.type ? (
          <Text variant="footnote" tone="secondary" numberOfLines={1}>{place.type}</Text>
        ) : null}

        <View style={styles.meta}>
          {place.rating !== undefined ? (
            <View style={styles.metaItem}>
              <Star size={icon.sm} color={colors.brand.peach} fill={colors.brand.peach} strokeWidth={0} />
              <Text variant="footnote">{place.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <Text variant="footnote" tone="tertiary">No rating yet</Text>
          )}
          {place.price ? <Text variant="footnote" tone="secondary">{place.price}</Text> : null}
          {place.area ? <Text variant="footnote" tone="secondary">{place.area}</Text> : null}
        </View>

        {place.openNow === undefined ? (
          <Text variant="caption" tone="tertiary">Hours unknown</Text>
        ) : (
          <Text variant="caption" tone={place.openNow ? 'violet' : 'tertiary'}>
            {place.openNow ? 'Open now' : 'Closed'}
          </Text>
        )}

        {place.reason ? (
          <View style={styles.reason}>
            <Text variant="footnote" tone="violet" numberOfLines={2}>{place.reason}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: radius.xl, backgroundColor: colors.surface.raised,
    overflow: 'hidden', ...shadow.card,
  },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md, gap: spacing.xxs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reason: {
    marginTop: spacing.xs, padding: spacing.xs,
    backgroundColor: colors.surface.accent, borderRadius: radius.sm,
  },
});
