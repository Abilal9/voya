import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import type { Place } from '@/services';
import { board, colors } from '@/theme';

/** Flat tints standing in for the board's photography until production imagery exists. */
export const PHOTO_TINT: Record<string, string> = {
  restaurant: '#E6DBE3',
  activity: '#D9DFC7',
  uffizi: '#F0DFE1',
  florence: '#EDE2F7',
  wedding: '#FFE9D2',
};

const E = board.explore;

/** Rating line, board style "4.6 ★ · $$$". Missing rating is "No rating yet", never 0. */
export function ratingLine(place: Place) {
  const rating = place.rating === undefined ? 'No rating yet' : `${place.rating.toFixed(1)} ★`;
  return [rating, place.price].filter(Boolean).join('  ·  ');
}

/**
 * E01 discovery card: full-bleed photo, "Picked for you" tag, details over a
 * dark scrim. Rating, price, photo and hours are all OPTIONAL — roughly a third
 * of the fixtures omit them on purpose, because provider data does.
 */
export function PlaceCard({ place, onOpen, tag }: { place: Place; onOpen?: () => void; tag?: string }) {
  const tint = place.photo ? (PHOTO_TINT[place.photo] ?? E.card.placeholder) : E.card.placeholder;
  const descriptor = [place.type, place.area].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}. Open details`}
      onPress={onOpen}
      disabled={!onOpen}
      style={[styles.card, { backgroundColor: tint }]}
    >
      {!place.photo ? (
        <View style={styles.noPhoto}>
          <Text style={styles.noPhotoText}>No photo available</Text>
        </View>
      ) : null}

      {tag || place.reason ? (
        <View style={styles.match}>
          <Text style={styles.matchText}>{tag ?? 'Picked for you'}</Text>
        </View>
      ) : null}

      <View style={styles.meta}>
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          colors={[`${E.meta.scrim}00`, `${E.meta.scrim}${E.meta.scrimAlphaHex}`]}
        />
        <Text style={styles.name} numberOfLines={2}>{place.name}</Text>
        {descriptor ? <Text style={styles.line} numberOfLines={1}>{descriptor}</Text> : null}
        <Text style={styles.line}>
          {place.permanentlyClosed ? 'Permanently closed' : ratingLine(place)}
        </Text>
        {place.reason ? <Text style={styles.reason} numberOfLines={2}>{place.reason}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: E.card.radius, overflow: 'hidden' },
  noPhoto: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontSize: E.match.fontSize, color: colors.text.secondary },
  match: {
    position: 'absolute', top: E.match.top, left: E.match.left, maxWidth: '85%',
    borderRadius: E.match.radius, paddingVertical: E.match.paddingY, paddingHorizontal: E.match.paddingX,
    backgroundColor: E.match.background,
  },
  matchText: { fontSize: E.match.fontSize, fontWeight: '500', color: colors.brand.plum },
  meta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: E.meta.paddingTop, paddingHorizontal: E.meta.paddingX, paddingBottom: E.meta.paddingBottom,
  },
  name: {
    fontSize: E.meta.nameSize, lineHeight: E.meta.nameLineHeight, fontWeight: '700',
    letterSpacing: board.home.title.letterSpacing, color: colors.text.inverse, marginBottom: E.meta.nameMarginBottom,
  },
  line: {
    fontSize: E.meta.lineSize, lineHeight: E.meta.lineSize * 1.5,
    color: E.meta.lineColor, marginBottom: E.meta.lineGap,
  },
  reason: {
    fontSize: E.meta.reasonSize, lineHeight: E.meta.reasonSize * 1.5,
    color: E.meta.reasonColor, marginTop: E.meta.reasonMarginTop - E.meta.lineGap,
  },
});
