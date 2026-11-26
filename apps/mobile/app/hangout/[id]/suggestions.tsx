import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { EmptyState, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { initialsOf } from '@/features/profile/avatar';
import { tintFor } from '@/features/hangout/HangoutParts';
import { useHangout } from '@/features/hangout/useHangout';
import { usePlaces } from '@/features/hangout/usePlaces';
import { VOYA_SUGGESTION, currentSlot, slotsFor, upVotes } from '@/services/hangoutRules';
import { board, colors, icon } from '@/theme';

const H = board.hangout;
const SEG = board.segment;

/**
 * 15 Group suggestions. One list per slot; tap the vote pill to vote or take
 * your vote back. Voting closes once the hangout is final.
 */
export default function Suggestions() {
  const { id, slot: slotParam } = useLocalSearchParams<{ id: string; slot?: string }>();
  const router = useRouter();
  const h = useHangout(id);
  const people = usePeople();
  const hangout = h.hangout;
  const slots = hangout ? slotsFor(hangout.template) : [];
  const [slot, setSlot] = React.useState<string | undefined>(slotParam);
  const active = slot && slots.includes(slot) ? slot : hangout ? currentSlot(hangout) : undefined;
  const places = usePlaces(hangout?.suggestions.map((s) => s.placeId) ?? []);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!hangout || !active) return <Screen><TopBar /><ErrorState message="This hangout isn’t available." /></Screen>;
  const list = hangout.suggestions.filter((s) => s.slot === active).sort((a, b) => upVotes(b) - upVotes(a));
  const canVote = h.relation === 'member' && !hangout.finalized;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={`${hangout.title} · ${active}`} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={styles.h1}>{`${active} ideas`}</Text>
          {canVote ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/hangout/${hangout.id}/suggest?slot=${encodeURIComponent(active)}`)} style={styles.suggestPill}>
              <Plus size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              <Text style={styles.suggestText}>Suggest</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.small}>A good idea can come from anyone.</Text>
        {slots.length > 1 ? (
          <View style={styles.seg}>
            {slots.map((s) => (
              <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: s === active }} onPress={() => setSlot(s)} style={[styles.segItem, s === active && styles.segOn]}>
                <Text style={[styles.segText, s === active && styles.segTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {list.length === 0 ? (
          <EmptyState title="No ideas yet" body={`Be the first to suggest a place for ${active.toLowerCase()}.`} />
        ) : (
          list.map((sg) => {
            const place = places.get(sg.placeId);
            const mine = sg.votes[h.me] === 'up';
            const by = sg.suggestedBy === VOYA_SUGGESTION ? undefined : people.byId.get(sg.suggestedBy);
            const n = upVotes(sg);
            return (
              <View key={sg.id} style={styles.suggestion}>
                <Pressable accessibilityRole="button" accessibilityLabel={place ? `${place.name}. Open details` : 'Place'} onPress={() => place && router.push(`/place/${place.id}`)} style={[styles.photo, { backgroundColor: tintFor(place) }]} />
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={2}>{place?.name ?? 'Place unavailable'}</Text>
                    <Text style={styles.small}>
                      {sg.suggestedBy === VOYA_SUGGESTION ? 'Voya suggestion'
                        : `${initialsOf(by?.firstName, by?.lastName) || '—'} · Suggested by ${by?.firstName ?? 'a former member'}`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={mine ? `Remove your vote for ${place?.name}` : `Vote for ${place?.name}`}
                    accessibilityState={{ selected: mine, disabled: !canVote }}
                    disabled={!canVote || h.busy}
                    onPress={() => void h.run(() => h.services.hangouts.vote(hangout.id, sg.id, mine ? null : 'up'))}
                    style={[styles.vote, mine && styles.voteOn]}
                  >
                    <Text style={styles.voteText}>{`${n} ${n === 1 ? 'vote' : 'votes'} ↑`}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        <Text style={styles.tiny}>{hangout.finalized ? 'Voting is closed — the plan is final.' : 'Vote for the places you’d love to go.'}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: board.inlineGap },
  h1: { ...board.h1, flex: 1, color: colors.brand.plum },
  suggestPill: {
    flexDirection: 'row', alignItems: 'center', gap: board.inlineGap / 2, borderRadius: H.vote.radius,
    paddingVertical: H.vote.paddingY, paddingHorizontal: H.vote.paddingX, backgroundColor: H.vote.background,
  },
  suggestText: { fontSize: H.vote.fontSize, fontWeight: '600', color: colors.brand.violet },
  small: { ...board.small, color: colors.text.secondary },
  seg: { flexDirection: 'row', gap: SEG.gap, padding: SEG.padding, borderRadius: SEG.radius, backgroundColor: SEG.background, marginTop: SEG.marginTop, marginBottom: SEG.marginBottom },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: SEG.itemPaddingY, borderRadius: SEG.itemRadius },
  segOn: { backgroundColor: colors.surface.base },
  segText: { fontSize: SEG.fontSize, color: colors.brand.plum },
  segTextOn: { color: colors.brand.violet, fontWeight: '600' },
  suggestion: { marginTop: H.suggestion.marginBottom },
  photo: { height: H.suggestion.photoHeight, borderRadius: board.photoRadius, marginBottom: H.suggestion.photoMarginBottom },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap },
  name: { fontSize: board.home.rowTitle.fontSize + 2, fontWeight: '700', color: colors.brand.plum, marginBottom: board.home.rowTitle.marginBottom },
  vote: { borderRadius: H.vote.radius, paddingVertical: H.vote.paddingY, paddingHorizontal: H.vote.paddingX, backgroundColor: H.vote.background },
  voteOn: { backgroundColor: colors.brand.lavender },
  voteText: { fontSize: H.vote.fontSize, color: colors.brand.violet },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  tiny: { ...board.tinyCenter, textAlign: 'center', marginTop: board.listRow.paddingY },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
