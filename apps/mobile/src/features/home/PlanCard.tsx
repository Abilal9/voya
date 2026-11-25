import { StyleSheet, View } from 'react-native';
import { CalendarDays, MapPin, PartyPopper, Users } from 'lucide-react-native';
import { AvatarStack, Card, Text } from '@/components/ui';
import type { Plan } from '@/services';
import { people } from '@/mocks/fixtures';
import { colors, icon, spacing } from '@/theme';

const LABEL: Record<Plan['type'], string> = {
  trip: 'Trip',
  hangout: 'Hangout',
  event: 'Event',
};

function formatWhen(plan: Plan) {
  if (!plan.startsAt) return 'Dates to be decided';
  const start = new Date(plan.startsAt);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (plan.type === 'trip' && plan.endsAt) {
    const end = new Date(plan.endsAt);
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  }
  return `${start.toLocaleDateString(undefined, { weekday: 'short', ...opts })} · ${start.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

export function PlanCard({ plan, onPress }: { plan: Plan; onPress?: () => void }) {
  const Icon = plan.type === 'trip' ? MapPin : plan.type === 'event' ? PartyPopper : Users;
  const names = plan.members
    .map((m) => people.find((p) => p.id === m.personId)?.displayName)
    .filter(Boolean) as string[];

  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Icon size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
        </View>
        <View style={styles.text}>
          <Text variant="overline" tone="tertiary">{LABEL[plan.type].toUpperCase()}</Text>
          <Text variant="title" numberOfLines={1}>{plan.title}</Text>
          <View style={styles.meta}>
            <CalendarDays size={icon.sm} color={colors.text.secondary} strokeWidth={icon.strokeWidth} />
            <Text variant="footnote" tone="secondary">{formatWhen(plan)}</Text>
          </View>
        </View>
      </View>
      {names.length > 0 ? (
        <View style={styles.footer}>
          <AvatarStack names={names} />
          <Text variant="caption" tone="tertiary">
            {plan.type === 'event'
              ? `${plan.guests.length} guests`
              : `${names.length} people`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  badge: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface.accent,
  },
  text: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
