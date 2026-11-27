import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Button, Text } from '@/components/ui';
import { usePeople } from '@/features/catalog';
import { hostLine } from '@/services/eventRules';
import type { RSVP } from '@/services';
import { board, colors, icon, layout } from '@/theme';
import { Cover, clock, eventStyles, longDate, openInMaps } from './EventParts';
import type { EventHook } from './useEvent';

const E = board.event;
const CHOICES: { rsvp: Exclude<RSVP, 'pending'>; label: string }[] = [
  { rsvp: 'going', label: 'Going' }, { rsvp: 'maybe', label: 'Maybe' }, { rsvp: 'declined', label: 'Can’t make it' },
];

/**
 * 20 Guest invitation. The wording comes from the event (`invitation`), or
 * falls back to its name and hosts. `preview` is the hosts' look at what
 * guests see (EV01 "Invitation"): the answers are shown but disabled.
 */
export function InvitationCard({ h, onAnswer, onDetails, preview }: {
  h: EventHook; onAnswer?: (rsvp: Exclude<RSVP, 'pending'>) => void; onDetails?: () => void; preview?: boolean;
}) {
  const router = useRouter();
  const people = usePeople();
  const { event } = h;
  const hosts = hostLine(event, (pid) => people.byId.get(pid)?.firstName ?? '');
  const eyebrow = event.invitation?.eyebrow ?? 'You’re invited';
  const headline = event.invitation?.headline ?? event.title;
  const line = event.invitation?.line ?? (hosts ? `Hosted by ${hosts}` : undefined);
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View>
          <Cover event={event} style={styles.cover} />
          <SafeAreaView edges={['top']} style={styles.backWrap}>
            <Pressable
              accessibilityRole="button" accessibilityLabel="Back" hitSlop={layout.minTouchTarget / 4}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back}
            >
              <ChevronLeft size={icon.xl} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
            </Pressable>
          </SafeAreaView>
        </View>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
          <Text style={styles.title}>{headline}</Text>
          {line ? <Text style={styles.line}>{line}</Text> : null}
          <View style={styles.divider} />
          <Text style={styles.when}>{longDate(event.startsAt)}</Text>
          <Text style={styles.muted}>{`${event.venue ?? event.city} · ${clock(event.startsAt)}`}</Text>
          <Pressable accessibilityRole="link" onPress={() => openInMaps(event)} style={styles.location}>
            <Text style={styles.locationText}>View location ↗</Text>
          </Pressable>
          <View style={styles.rsvp}>
            {CHOICES.map((c) => {
              const on = !preview && h.myRsvp === c.rsvp;
              return (
                <Pressable
                  key={c.rsvp} accessibilityRole="button" accessibilityState={{ selected: on, disabled: preview || h.busy }}
                  disabled={preview || h.busy} onPress={() => onAnswer?.(c.rsvp)}
                  style={[styles.choice, on && styles.choiceOn, c.rsvp === 'going' && preview && styles.choiceOn]}
                >
                  <Text style={styles.choiceText}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {preview ? <Text style={eventStyles.tinyCenter}>This is what your guests see. They answer here.</Text> : null}
          {h.error ? <Text style={eventStyles.error}>{h.error}</Text> : null}
          {onDetails ? <Button label="View event details" variant="ghost" onPress={onDetails} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  cover: {
    height: E.weddingCover.height, borderRadius: E.weddingCover.topRadius,
    borderBottomLeftRadius: E.weddingCover.bottomRadius, borderBottomRightRadius: E.weddingCover.bottomRadius,
    marginBottom: E.weddingCover.marginBottom,
  },
  backWrap: { position: 'absolute', left: board.screenPaddingX, top: 0 },
  back: {
    width: layout.minTouchTarget, height: layout.minTouchTarget, borderRadius: layout.minTouchTarget / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base,
  },
  body: { paddingHorizontal: board.screenPaddingX, alignItems: 'center' },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, textAlign: 'center' },
  title: {
    fontSize: E.invitationTitle.size, letterSpacing: E.invitationTitle.letterSpacing, lineHeight: E.invitationTitle.lineHeight,
    fontWeight: '400', color: colors.brand.plum, textAlign: 'center', marginVertical: E.invitationTitle.marginY,
  },
  line: { fontSize: E.invitationLine.size, color: colors.brand.plum, marginTop: E.invitationLine.marginTop, textAlign: 'center' },
  divider: { width: E.divider.width, height: 1, backgroundColor: E.divider.color, marginVertical: E.divider.marginY },
  when: { fontSize: board.hangout.formRow.fontSize, color: colors.brand.plum, textAlign: 'center' },
  muted: { ...board.small, color: colors.text.secondary, textAlign: 'center' },
  location: { paddingVertical: board.inlineGap, marginTop: board.inlineGap },
  locationText: { fontSize: E.rsvp.fontSize, fontWeight: '600', color: colors.brand.violet },
  rsvp: { flexDirection: 'row', gap: E.rsvp.gap, marginTop: E.rsvp.marginTop, marginBottom: E.rsvp.marginBottom, alignSelf: 'stretch' },
  choice: { flex: 1, alignItems: 'center', backgroundColor: E.rsvp.background, borderRadius: E.rsvp.radius, paddingVertical: E.rsvp.paddingY },
  choiceOn: { backgroundColor: colors.brand.peach },
  choiceText: { fontSize: E.rsvp.fontSize, fontWeight: '600', color: colors.brand.plum },
});
