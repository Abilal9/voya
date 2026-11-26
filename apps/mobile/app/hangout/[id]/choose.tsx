import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, Heart, Plus, X } from 'lucide-react-native';
import { EmptyState, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { SwipeDeck, type SwipeDeckHandle } from '@/features/explore/SwipeDeck';
import { useSavedPlaces } from '@/features/explore/useSavedPlaces';
import { SlotSteps } from '@/features/hangout/HangoutParts';
import { useHangout } from '@/features/hangout/useHangout';
import { SLOT_CATEGORIES, currentSlot, slotSummary, slotsFor } from '@/services/hangoutRules';
import type { Place } from '@/services';
import { board, colors, icon } from '@/theme';

const E = board.explore;

/**
 * 14 Choose together. A deck of the slot's group suggestions, then places that fit it. "Yes"
 * votes for the place (adding it as a Voya suggestion if nobody suggested
 * it), "No" just moves on, "Save" keeps it in Saved.
 */
export default function ChooseTogether() {
  const { id, slot: slotParam } = useLocalSearchParams<{ id: string; slot?: string }>();
  const router = useRouter();
  const h = useHangout(id);
  const saved = useSavedPlaces();
  const deck = React.useRef<SwipeDeckHandle>(null);
  const hangout = h.hangout;
  const slots = hangout ? slotsFor(hangout.template) : [];
  const slot = slotParam && slots.includes(slotParam) ? slotParam : hangout ? currentSlot(hangout) : undefined;

  const candidates = useQuery({
    queryKey: ['choose', id, slot, hangout?.city],
    // The group's own suggestions for this slot come first, then fresh picks.
    queryFn: async () => {
      const svc = h.services.places;
      const suggested = await Promise.all(hangout!.suggestions.filter((sg) => sg.slot === slot).map((sg) => svc.getPlace(sg.placeId)));
      const fresh = await svc.discover({ city: hangout!.city, categories: SLOT_CATEGORIES[slot!] ?? [] });
      return [...new Map([...suggested, ...fresh].map((p) => [p.id, p])).values()];
    },
    enabled: !!hangout && !!slot,
  });
  const [top, setTop] = React.useState(0);
  React.useEffect(() => setTop(0), [candidates.data]);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!hangout || !slot) return <Screen><TopBar /><ErrorState message="This hangout isn’t available." /></Screen>;
  if (h.relation !== 'member') return <Screen><TopBar /><EmptyState title="Join to choose together" body="Answer the invitation first." /></Screen>;

  const states = Object.fromEntries(slots.map((s) => [s, s === slot ? 'Choosing now' : slotSummary(hangout, s).state === 'chosen' ? 'Chosen' : 'Up next']));
  const results = candidates.data ?? [];
  const current: Place | undefined = results[top];
  const likedBy = (p: Place) => {
    const sg = hangout.suggestions.find((s) => s.placeId === p.id && s.slot === slot);
    const n = sg ? Object.entries(sg.votes).filter(([who, v]) => v === 'up' && who !== h.me).length : 0;
    return n ? `${n} ${n === 1 ? 'friend' : 'friends'} already liked this` : undefined;
  };
  const onSwipe = async (place: Place, dir: 'like' | 'dislike') => {
    setTop((i) => i + 1);
    if (dir === 'like') await h.run(() => h.services.hangouts.voteForPlace(hangout.id, slot, place.id));
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={`${slot} · ${hangout.city}`} />
      <Text style={styles.h1} numberOfLines={1}>{hangout.title}</Text>
      <SlotSteps slots={slots} current={slot} states={states} />
      {hangout.finalized ? (
        <EmptyState title="This hangout is final" body="Suggest a change from the timeline instead." />
      ) : candidates.isPending ? (
        <LoadingState label="Finding places" />
      ) : !current ? (
        <EmptyState
          title={results.length ? 'You’ve seen every idea' : 'No places here yet'}
          body="See what the group suggested, or suggest a place."
          actionLabel="Group suggestions"
          onAction={() => router.replace(`/hangout/${hangout.id}/suggestions?slot=${encodeURIComponent(slot)}`)}
        />
      ) : (
        <>
          <SwipeDeck ref={deck} places={results} onSwipe={(p, d) => void onSwipe(p, d)} onOpen={(p) => router.push(`/place/${p.id}`)} tagFor={likedBy} />
          <View style={styles.actions}>
            <Choice label="No" background={E.actions.skipBackground} onPress={() => deck.current?.dislike()}>
              <X size={E.actions.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
            </Choice>
            <Choice label="Save" background={saved.isSaved(current.id) ? colors.brand.peach : E.actions.saveBackground} onPress={() => void saved.toggle(current.id)}>
              <Heart size={E.actions.icon} color={saved.isSaved(current.id) ? colors.brand.plum : E.actions.saveColor} fill={saved.isSaved(current.id) ? colors.brand.plum : 'transparent'} strokeWidth={icon.strokeWidth} />
            </Choice>
            <Choice label="Yes" background={colors.brand.peach} onPress={() => deck.current?.like()}>
              <Check size={E.actions.icon} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
            </Choice>
          </View>
        </>
      )}
      {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" onPress={() => router.push(`/hangout/${hangout.id}/suggest?slot=${encodeURIComponent(slot)}`)} style={styles.suggest}>
        <Plus size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
        <Text style={styles.suggestText}>Suggest a place</Text>
      </Pressable>
    </Screen>
  );
}

function Choice({ label, background, onPress, children }: { label: string; background: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.choice}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.round, { backgroundColor: background }]}>
        {children}
      </Pressable>
      <Text style={styles.choiceLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { ...board.h1, color: colors.brand.plum },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: E.actions.gap, marginTop: E.actions.marginTop },
  choice: { alignItems: 'center', gap: E.actions.labelGap },
  round: { width: E.actions.size, height: E.actions.size, borderRadius: E.actions.size / 2, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontSize: E.actions.labelSize, color: E.actions.labelColor },
  spacer: { flex: 1 },
  suggest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: board.inlineGap / 2, paddingVertical: board.listRow.paddingY },
  suggestText: { fontSize: board.form.linkSize + 1, color: colors.brand.violet },
  error: { ...board.small, color: colors.status.danger, textAlign: 'center' },
});
