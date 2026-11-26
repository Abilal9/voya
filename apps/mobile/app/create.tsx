import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Plane, Users } from 'lucide-react-native';
import { Screen, Text, TopBar } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { board, colors, icon } from '@/theme';

const C = board.create;

const OPTIONS = [
  { type: 'trip', Icon: Plane, title: 'Trip', body: 'Plan several days together' },
  { type: 'hangout', Icon: Users, title: 'Hangout', body: 'Decide where to go and what to do' },
  { type: 'event', Icon: CalendarDays, title: 'Event', body: 'Invite guests and organize the schedule' },
] as const;

/** 02 Create a Plan — board figure "02". */
export default function Create() {
  const router = useRouter();
  const services = useServices();
  const [busy, setBusy] = React.useState(false);

  // Hangouts (13) and Events (18) have their own creation flows. KNOWN GAP: Trip
  // creation (03–09) is not built yet; that option creates a draft and opens it.
  const create = async (type: (typeof OPTIONS)[number]['type']) => {
    if (busy) return;
    if (type === 'hangout' || type === 'event') {
      router.push(type === 'hangout' ? '/hangout/new' : '/event/new');
      return;
    }
    setBusy(true);
    try {
      const now = Date.now();
      const soon = new Date(now + 7 * 86400000).toISOString();
      const plan = await services.plans.createTrip({
        title: 'New trip', destination: 'Dubai', startsAt: soon,
        endsAt: new Date(now + 10 * 86400000).toISOString(),
      });
      router.replace(`/plan/${plan.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.screen}>
      <TopBar title="New plan" />
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>A GOOD TIME STARTS HERE</Text>
        <Text style={styles.h1}>{'What are you\nplanning?'}</Text>
        <Text style={styles.muted}>Big adventures. Little get-togethers.</Text>
      </View>
      {OPTIONS.map(({ type, Icon, title, body }, i) => (
        <Pressable
          key={type}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${body}`}
          disabled={busy}
          onPress={() => void create(type)}
          style={[styles.option, { backgroundColor: C.optionBackgrounds[i] }]}
        >
          <View style={styles.symbol}>
            <Icon size={C.symbol.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.h3}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        </Pressable>
      ))}
      <View style={styles.spacer} />
      <Text style={styles.tiny}>Different plans. The same simple feeling.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: board.screenPaddingX, flex: 1 },
  intro: { marginTop: C.introMarginTop - board.topBar.marginBottom },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, marginBottom: board.inlineGap },
  h1: { ...board.h1, color: colors.brand.plum },
  muted: { ...board.small, color: colors.text.secondary, marginBottom: board.inlineGap },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: C.option.gap,
    paddingVertical: C.option.paddingY, paddingHorizontal: C.option.paddingX,
    borderRadius: C.option.radius, marginVertical: C.option.marginY, minHeight: C.option.minHeight,
  },
  symbol: {
    width: C.symbol.size, height: C.symbol.size, borderRadius: C.symbol.radius,
    backgroundColor: C.symbol.background, alignItems: 'center', justifyContent: 'center',
  },
  optionText: { flex: 1 },
  h3: { ...board.home.sectionTitle, marginBottom: 0, color: colors.brand.plum },
  body: { fontSize: C.bodySize, lineHeight: C.bodySize * 1.5, marginTop: C.bodyMarginTop, color: colors.brand.plum },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  tiny: { ...board.tinyCenter, textAlign: 'center' },
});
