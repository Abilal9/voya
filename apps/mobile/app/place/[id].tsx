import * as React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Navigation } from 'lucide-react-native';
import { Button, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import { hoursLine } from '@/features/explore/placeFormat';
import { useSavedPlaces } from '@/features/explore/useSavedPlaces';
import { useServices } from '@/services/ServicesProvider';
import { board, colors, icon, layout } from '@/theme';

const P = board.place;

/**
 * E08 Place details — board figure "E08". Save uses the shared Saved state,
 * so it matches Explore, Search and Saved. Add to Plan opens E09.
 */
export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const services = useServices();
  const saved = useSavedPlaces();
  const place = useQuery({ queryKey: ['place', id], queryFn: () => services.places.getPlace(id!), enabled: !!id });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (place.isPending) return <Screen><LoadingState label="Loading place" /></Screen>;
  if (place.isError || !place.data) {
    return (
      <Screen>
        <ErrorState message="This place isn’t available right now." onRetry={() => void place.refetch()} />
        <Button label="Back" variant="ghost" onPress={back} />
      </Screen>
    );
  }

  const p = place.data;
  const isSaved = saved.isSaved(p.id);
  const tint = p.photo ? (PHOTO_TINT[p.photo] ?? board.explore.card.placeholder) : board.explore.card.placeholder;
  const subtitle = [p.type?.split(' · ')[0], p.city, p.price].filter(Boolean).join(' · ');
  const details = [
    hoursLine(p),
    [p.area, p.city].filter(Boolean).join(', '),
    p.price ? `Approximate price · ${p.price}` : 'Price not listed',
  ];
  const directions = p.coordinates
    ? `http://maps.apple.com/?ll=${p.coordinates.latitude},${p.coordinates.longitude}&q=${encodeURIComponent(p.name)}`
    : undefined;

  const SaveIcon = (
    <Heart
      size={icon.lg} color={colors.brand.violet}
      fill={isSaved ? colors.brand.violet : 'transparent'} strokeWidth={icon.strokeWidth}
    />
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={layout.minTouchTarget / 4} style={styles.topButton}>
            <ChevronLeft size={icon.lg} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
          </Pressable>
          <Text style={styles.topTitle}>{`${p.city} · Place details`}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from Saved' : 'Save'}
            accessibilityState={{ selected: isSaved }}
            onPress={() => void saved.toggle(p.id)}
            hitSlop={layout.minTouchTarget / 4}
            style={styles.topButton}
          >
            {SaveIcon}
          </Pressable>
        </View>

        <View style={[styles.hero, { backgroundColor: tint }]}>
          {!p.photo ? <Text style={styles.noPhoto}>No photo available</Text> : null}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.h1} numberOfLines={3}>{p.name}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{p.rating !== undefined ? `${p.rating.toFixed(1)} ★` : 'No rating yet'}</Text>
          </View>
        </View>
        <Text style={styles.muted}>{subtitle}</Text>

        {p.reason ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why you&apos;ll like it</Text>
            <Text style={styles.sectionBody}>{p.reason}</Text>
          </View>
        ) : null}
        {p.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.sectionBody}>{p.description}</Text>
          </View>
        ) : null}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.sectionBody}>{details.join('\n')}</Text>
        </View>

        {p.permanentlyClosed ? null : (
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="Add to Plan" onPress={() => router.push(`/add-to-plan/${p.id}`)} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Remove from Saved' : 'Save for later'}
              accessibilityState={{ selected: isSaved }}
              onPress={() => void saved.toggle(p.id)}
              style={styles.saveButton}
            >
              {SaveIcon}
            </Pressable>
          </View>
        )}
        {directions ? (
          <Button
            label="Open map / Directions"
            variant="ghost"
            icon={<Navigation size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />}
            onPress={() => void Linking.openURL(directions)}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  content: { paddingHorizontal: board.screenPaddingX, paddingBottom: board.listRow.paddingY },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: P.top.gap, marginBottom: P.top.marginBottom },
  topButton: { padding: P.top.buttonPadding },
  topTitle: { fontSize: P.top.titleSize, color: colors.text.secondary },
  hero: {
    height: P.heroHeight, marginHorizontal: -board.screenPaddingX, marginBottom: P.heroMarginBottom,
    borderBottomLeftRadius: P.heroRadius, borderBottomRightRadius: P.heroRadius,
    alignItems: 'center', justifyContent: 'center',
  },
  noPhoto: { ...board.small, color: colors.text.secondary },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: board.inlineGap },
  h1: { ...board.h1, flex: 1, color: colors.brand.plum, marginBottom: P.titleMarginBottom },
  pill: {
    paddingVertical: P.pill.paddingY, paddingHorizontal: P.pill.paddingX, borderRadius: P.pill.radius,
    backgroundColor: P.pill.background, marginTop: board.h2MarginBottom / 2,
  },
  pillText: { fontSize: P.pill.fontSize, fontWeight: '600', color: colors.brand.violet },
  muted: { ...board.small, color: colors.text.secondary },
  section: { paddingVertical: P.section.paddingY, borderBottomWidth: 1, borderBottomColor: P.section.border },
  sectionTitle: { fontSize: P.section.titleSize, fontWeight: '600', color: colors.brand.plum, marginBottom: board.home.sectionTitle.marginBottom },
  sectionBody: { fontSize: P.section.bodySize, lineHeight: P.section.bodyLineHeight, color: P.section.bodyColor },
  actions: { flexDirection: 'row', gap: P.actions.gap, marginTop: P.actions.marginTop },
  flex: { flex: 1 },
  saveButton: {
    width: P.actions.saveWidth, borderRadius: P.actions.saveRadius, backgroundColor: P.actions.saveBackground,
    alignItems: 'center', justifyContent: 'center',
  },
});
