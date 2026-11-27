import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { AvatarStack, Button, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { useSavedPlaces } from '@/features/explore/useSavedPlaces';
import { Pill, Timeline, tintFor, whenLabel } from '@/features/hangout/HangoutParts';
import { useHangout } from '@/features/hangout/useHangout';
import { usePlaces } from '@/features/hangout/usePlaces';
import {
  VOYA_SUGGESTION, canFinalize, peopleCounts, slotSummary, slotsFor,
} from '@/services/hangoutRules';
import { classifyPlan } from '@/services/planRules';
import type { Hangout } from '@/services';
import { ServiceError } from '@/services';
import { board, colors, icon } from '@/theme';

const H = board.hangout;

/**
 * One route for a hangout; what it shows depends on the canonical state:
 * an invitation (17) for pending invitees, the lobby (37) while planning,
 * the final timeline (16) once finalized, completed (H05) once it is past.
 */
export default function HangoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useHangout(id);
  if (h.isPending) return <Screen><LoadingState label="Loading hangout" /></Screen>;
  const hangout = h.hangout;
  if (h.isError && !(h.failureReason instanceof ServiceError && h.failureReason.code === 'not_found')) {
    return <Screen><TopBar /><ErrorState error={h.failureReason} onRetry={() => void h.refetch()} /></Screen>;
  }
  if (!hangout) return <Screen><TopBar /><ErrorState message="This hangout isn’t available." onRetry={() => void h.refetch()} /></Screen>;
  const hh: HangoutHook = { ...h, hangout };
  if (h.relation === 'invited') return <Invitation h={hh} />;
  if (classifyPlan(hangout) === 'past') return <Completed h={hh} />;
  if (hangout.finalized) return <Final h={hh} />;
  return <Lobby h={hh} />;
}

type HangoutHook = ReturnType<typeof useHangout> & { hangout: Hangout };

function useNames(h: Hangout) {
  const people = usePeople();
  const nameOf = (id: string) => people.byId.get(id)?.displayName ?? 'Former member';
  const confirmed = [h.ownerId, ...(h.invites ?? []).filter((i) => i.status !== 'declined').map((i) => i.personId)];
  return { nameOf, stackNames: confirmed.map(nameOf), organizer: nameOf(h.ownerId).split(' ')[0] };
}

function Header({ h, right }: { h: HangoutHook; right?: boolean }) {
  const router = useRouter();
  return (
    <TopBar
      title={h.hangout.finalized ? `${h.hangout.city} · ${new Date(h.hangout.startsAt!).toLocaleDateString(undefined, { weekday: 'long' })}` : 'Your hangout'}
      right={right ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Hangout settings" onPress={() => router.push(`/hangout/${h.hangout.id}/settings`)} hitSlop={board.inlineGap}>
          <MoreHorizontal size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
        </Pressable>
      ) : undefined}
    />
  );
}

/** 17 Join Hangout. */
function Invitation({ h }: { h: HangoutHook }) {
  const router = useRouter();
  const { hangout } = h;
  const { stackNames, organizer } = useNames(hangout);
  const others = Math.max(0, stackNames.length - 1);
  const answer = async (r: 'in' | 'maybe') => {
    const ok = await h.run(() => h.services.hangouts.respond(hangout.id, r));
    if (ok !== undefined) router.replace(`/hangout/${hangout.id}`);
  };
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="A Voya invitation" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { backgroundColor: tintFor() }]} />
        <View style={styles.center}>
          <Text style={styles.eyebrow}>YOU&apos;RE INVITED</Text>
          <Text style={styles.inviteTitle} numberOfLines={2}>{hangout.title}</Text>
          <Text style={styles.muted}>{whenLabel(hangout.startsAt)}</Text>
          <Text style={styles.muted}>{hangout.city}</Text>
          <View style={styles.stackCenter}><AvatarStack names={stackNames} /></View>
          <Text style={styles.small}>{`${organizer}${others ? ` + ${others} ${others === 1 ? 'friend' : 'friends'}` : ''}`}</Text>
        </View>
        <View style={styles.chain}><Text style={styles.chainText}>{slotsFor(hangout.template).join('  →  ')}</Text></View>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={authStyles.foot}>
          <Button label="I'm in" onPress={() => void answer('in')} loading={h.busy} />
          <Button label="Maybe" variant="secondary" onPress={() => void answer('maybe')} disabled={h.busy} />
          <Button label="Can't make it" variant="ghost" onPress={() => void h.run(() => h.services.hangouts.respond(hangout.id, 'declined')).then(() => router.back())} disabled={h.busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** 37 Hangout lobby. */
function Lobby({ h }: { h: HangoutHook }) {
  const router = useRouter();
  const { hangout } = h;
  const { stackNames, nameOf, organizer } = useNames(hangout);
  const places = usePlaces(hangout.suggestions.map((s) => s.placeId));
  const counts = peopleCounts(hangout);
  const others = Math.max(0, stackNames.length - 1);
  const latest = [...hangout.suggestions].reverse().find((s) => s.suggestedBy !== h.me && s.suggestedBy !== VOYA_SUGGESTION);
  const ready = h.isOrganizer && canFinalize(hangout);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <Header h={h} right />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.h1} numberOfLines={2}>{hangout.title}</Text>
          <Pill label="Planning" />
        </View>
        <Text style={styles.muted}>{whenLabel(hangout.startsAt)}</Text>
        <Text style={styles.muted}>{hangout.city}</Text>
        <View style={styles.peopleRow}>
          <AvatarStack names={stackNames} />
          <Text style={styles.small}>{`${organizer}${others ? ` + ${others} ${others === 1 ? 'friend' : 'friends'}` : ''}`}</Text>
        </View>

        <View style={styles.lobby}>
          {slotsFor(hangout.template).map((slot, i, all) => {
            const sum = slotSummary(hangout, slot);
            const leaderPlace = sum.leader ? places.get(sum.leader.placeId) : undefined;
            return (
              <View key={slot} style={[styles.lobbyStop]}>
                <Text style={styles.stopNum}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={styles.lineCol}>
                  <View style={styles.dot} />
                  {i < all.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.stopTitle}>{slot}</Text>
                  {sum.state === 'chosen' && leaderPlace ? <Text style={styles.small}>{leaderPlace.name}</Text> : null}
                  {sum.state === 'chosen' ? <View style={styles.pillGap}><Pill label="✓ Chosen" /></View>
                    : sum.state === 'voting' ? <View style={styles.pillGap}><Pill label={`${sum.voted} of ${sum.of} voted`} /></View>
                      : <Text style={styles.small}>Waiting · No decision yet</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {ready ? (
          <Button label="Finalize plan" onPress={() => void h.run(() => h.services.hangouts.finalize(hangout.id))} loading={h.busy} />
        ) : (
          <Button label="Continue choosing" onPress={() => router.push(`/hangout/${hangout.id}/choose`)} />
        )}
        <Pressable accessibilityRole="button" onPress={() => router.push(`/hangout/${hangout.id}/suggestions`)} style={styles.link}>
          <Text style={styles.linkText}>See group suggestions</Text>
          <ChevronRight size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
        </Pressable>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}

        <Pressable accessibilityRole="button" onPress={() => router.push(`/hangout/${hangout.id}/people`)}>
          <Text style={styles.h3}>People</Text>
          <View style={styles.peopleRow}>
            <AvatarStack names={stackNames} />
            <View>
              <Text style={styles.smallRight}>{`${counts.invited} invited`}</Text>
              <Text style={styles.smallRight}>{`${counts.confirmed} confirmed`}</Text>
            </View>
          </View>
        </Pressable>

        {latest ? (
          <View style={styles.activity}>
            <AvatarStack names={[nameOf(latest.suggestedBy)]} />
            <Text style={styles.small}>{`${nameOf(latest.suggestedBy).split(' ')[0]} suggested ${places.get(latest.placeId)?.name ?? 'a place'}`}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** 16 Final timeline. */
function Final({ h }: { h: HangoutHook }) {
  const router = useRouter();
  const { hangout } = h;
  const { stackNames } = useNames(hangout);
  const places = usePlaces(hangout.timeline.map((t) => t.placeId).filter((x): x is string => !!x));
  const everyone = (hangout.invites ?? []).every((i) => i.status === 'in');
  const mine = h.myResponse;
  const pending = (hangout.changeRequests ?? []).length;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <Header h={h} right />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1} numberOfLines={2}>{hangout.title}</Text>
        <View style={styles.peopleRow}>
          {everyone ? <Pill label="✓ Everyone's in" /> : <Pill label={`${peopleCounts(hangout).confirmed} going`} />}
          <AvatarStack names={stackNames} />
        </View>
        <View style={styles.timelineGap}>
          <Timeline items={hangout.timeline} places={places} withPhotos onOpenPlace={(pid) => router.push(`/place/${pid}`)} />
        </View>
        {pending ? <Text style={styles.small}>{`${pending} change ${pending === 1 ? 'suggestion' : 'suggestions'} sent to the organizer`}</Text> : null}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={authStyles.foot}>
          {mine !== 'in' ? (
            <Button label="I'm in" onPress={() => void h.run(() => h.services.hangouts.respond(hangout.id, 'in'))} loading={h.busy} />
          ) : (
            <View style={styles.inRow}><Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /><Text style={styles.linkText}>You&apos;re in</Text></View>
          )}
          <Button label="Suggest a change" variant="ghost" onPress={() => router.push(`/hangout/${hangout.id}/change`)} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** H05 Hangout completed. */
function Completed({ h }: { h: HangoutHook }) {
  const router = useRouter();
  const saved = useSavedPlaces();
  const { hangout } = h;
  const { stackNames } = useNames(hangout);
  const ids = hangout.timeline.map((t) => t.placeId).filter((x): x is string => !!x);
  const places = usePlaces(ids);
  const allSaved = ids.length > 0 && ids.every((pid) => saved.isSaved(pid));
  const saveAll = async () => {
    for (const pid of ids) if (!saved.isSaved(pid)) await saved.toggle(pid);
  };
  const date = new Date(hangout.startsAt!).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Past Plans" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { backgroundColor: tintFor(places.get(ids[0] ?? '')) }]} />
        <Text style={styles.title} numberOfLines={2}>{hangout.title}</Text>
        <Text style={styles.muted}>{`${date} · ${hangout.city} · ${stackNames.length} ${stackNames.length === 1 ? 'person' : 'friends'}`}</Text>
        <View style={styles.peopleRow}><AvatarStack names={stackNames} /></View>
        {hangout.timeline.length ? <Timeline items={hangout.timeline} places={places} /> : <Text style={styles.small}>No timeline was saved for this hangout.</Text>}
        {ids.length ? (
          <Pressable accessibilityRole="button" disabled={allSaved} onPress={() => void saveAll()} style={styles.link}>
            <Text style={styles.linkText}>{allSaved ? 'Places saved' : 'Save these places'}</Text>
          </Pressable>
        ) : null}
        <View style={authStyles.foot}>
          <Button label="Plan another hangout" onPress={() => router.push('/hangout/new')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  cover: { height: H.cover.height, borderRadius: board.photoRadius, marginBottom: H.cover.marginBottom },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, marginBottom: board.inlineGap },
  inviteTitle: { ...board.h1, fontSize: H.invite.titleSize, textAlign: 'center', color: colors.brand.plum },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: board.inlineGap },
  h1: { ...board.h1, flex: 1, color: colors.brand.plum },
  title: { ...board.h1, color: colors.brand.plum, marginBottom: board.inlineGap },
  h3: { ...board.home.sectionTitle, color: colors.brand.plum, marginTop: board.home.upNext.marginBottom },
  muted: { ...board.small, color: colors.text.secondary },
  small: { ...board.small, color: colors.text.secondary },
  smallRight: { ...board.small, color: colors.text.secondary, textAlign: 'right' },
  stackCenter: { marginVertical: board.listRow.paddingY },
  peopleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: board.listRow.paddingY },
  chain: {
    padding: board.listRow.paddingY + 4, borderRadius: board.action.radius, backgroundColor: board.action.secondaryBackground,
    alignItems: 'center', marginTop: board.home.upNext.marginBottom,
  },
  chainText: { fontSize: board.form.introBodySize, color: colors.brand.plum },
  lobby: { marginTop: H.lobbyMarginTop, marginBottom: H.lobbyMarginBottom },
  lobbyStop: { flexDirection: 'row', gap: H.stop.gap, minHeight: H.lobbyStop.minHeight },
  stopNum: { width: H.stop.timeWidth, fontSize: H.stop.timeSize, color: H.stop.timeColor, paddingTop: H.stop.timePaddingTop },
  lineCol: { width: H.stop.lineWidth, alignItems: 'center' },
  dot: { width: H.stop.dot, height: H.stop.dot, borderRadius: H.stop.dot / 2, backgroundColor: colors.brand.lavender, marginTop: H.stop.dotMarginTop },
  line: { flex: 1, width: 1, backgroundColor: H.stop.lineColor, marginTop: H.stop.timePaddingTop },
  stopTitle: { fontSize: H.lobbyStop.titleSize, fontWeight: '700', color: colors.brand.plum, marginBottom: H.lobbyStop.titleMarginBottom / 2 },
  pillGap: { marginTop: H.stop.titleMarginBottom },
  timelineGap: { marginTop: board.home.upNext.marginTop },
  link: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap / 2, paddingVertical: board.listRow.paddingY },
  linkText: { fontSize: board.form.linkSize, color: colors.brand.violet },
  inRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: board.inlineGap, minHeight: board.action.minHeight },
  activity: {
    flexDirection: 'row', alignItems: 'center', gap: board.inlineGap, padding: H.selection.padding / 1.5,
    borderRadius: H.selection.radius, backgroundColor: H.selection.background, marginTop: board.listRow.paddingY,
  },
  error: { ...board.small, color: colors.status.danger, marginVertical: board.inlineGap },
});
