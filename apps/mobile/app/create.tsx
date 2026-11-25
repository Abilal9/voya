import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, PartyPopper, Users } from 'lucide-react-native';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { colors, icon, spacing } from '@/theme';

const OPTIONS = [
  { type: 'trip', Icon: MapPin, title: 'Trip', body: 'Plan travel together — dates, places, itinerary.' },
  { type: 'hangout', Icon: Users, title: 'Hangout', body: 'Decide where to go tonight, as a group.' },
  { type: 'event', Icon: PartyPopper, title: 'Event', body: 'Host something and invite guests.' },
] as const;

/** 02 Create a Plan. */
export default function Create() {
  const router = useRouter();
  const services = useServices();

  const create = async (type: (typeof OPTIONS)[number]['type']) => {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 86400000).toISOString();
    const plan =
      type === 'trip'
        ? await services.plans.createTrip({
            title: 'New trip', destination: 'Dubai', startsAt: soon,
            endsAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
          })
        : type === 'hangout'
          ? await services.plans.createHangout({
              title: 'New hangout', city: 'Riyadh', template: 'Dinner + Dessert', startsAt: soon,
            })
          : await services.plans.createEvent({ title: 'New event', city: 'Riyadh', startsAt: soon });
    router.replace(`/plan/${plan.id}`);
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="h1">Create a plan</Text>
        <Text variant="body" tone="secondary">What are you organising?</Text>
      </View>
      <View style={styles.list}>
        {OPTIONS.map(({ type, Icon, title, body }) => (
          <Card key={type} onPress={() => void create(type)}>
            <View style={styles.row}>
              <View style={styles.badge}>
                <Icon size={icon.lg} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              </View>
              <View style={styles.text}>
                <Text variant="title">{title}</Text>
                <Text variant="footnote" tone="secondary">{body}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  list: { flex: 1, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.surface.accent,
  },
  text: { flex: 1, gap: 2 },
});
