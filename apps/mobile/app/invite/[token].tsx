import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2Off, Mail } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { ServiceError, type PlanType } from '@/services';
import { useServices } from '@/services/ServicesProvider';
import { board, colors } from '@/theme';

const KIND: Record<PlanType, string> = { trip: 'trip', hangout: 'hangout', event: 'event' };

/** Human copy for each invitation failure; internal messages are never shown. */
function failure(e: unknown) {
  const code = e instanceof ServiceError ? e.code : '';
  if (code === 'expired') return { title: 'This invitation has expired', body: 'Ask whoever invited you to send a new one.' };
  if (code === 'revoked') return { title: 'This invitation was withdrawn', body: 'The organizer turned this invitation off.' };
  if (code === 'not_found') return { title: 'This plan isn’t available', body: 'It may have finished, been cancelled or removed.' };
  return { title: 'This invitation isn’t valid', body: 'Check the link, or ask for a new invitation.' };
}

/**
 * Invitation entry point (development only for now). A link such as
 * `exp://…/--/invite/inv-florence` in Expo Go opens here; signed-out people
 * sign in first and come back. The preview shows only what the invitation
 * says (type, name, who invited you), never the plan itself; opening it puts
 * you on the invite list and the plan's own invitation screen takes over.
 * Real links (voya.events, Universal Links) replace this once the backend
 * issues tokens.
 */
export default function InviteEntry() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>();
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => services.invitations.resolve(token!),
    enabled: !!token && __DEV__,
    retry: false,
  });

  if (!__DEV__) {
    return (
      <Screen><TopBar /><EmptyState icon={Link2Off} title="Invitation links are coming" body="Invitation links will be available when Voya launches." actionLabel="Back to Home" onAction={() => router.replace('/(tabs)')} /></Screen>
    );
  }
  if (invite.isPending) return <Screen><LoadingState label="Opening invitation" /></Screen>;
  const problem = invite.error ?? error ?? (invite.data?.expired ? new ServiceError('expired', '', false) : invite.data?.revoked ? new ServiceError('revoked', '', false) : undefined);
  if (problem || !invite.data) {
    const f = failure(problem);
    return (
      <Screen><TopBar /><EmptyState icon={Link2Off} title={f.title} body={f.body} actionLabel="Back to Home" onAction={() => router.replace('/(tabs)')} /></Screen>
    );
  }
  const inv = invite.data;
  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await services.invitations.accept(inv.token);
      await qc.invalidateQueries({ queryKey: ['plans'] });
      await qc.invalidateQueries({ queryKey: ['plan', r.planId] });
      router.replace(`/${r.planType}/${r.planId}` as never);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="A Voya invitation" onBack={() => router.replace('/(tabs)')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.symbol}><Mail size={board.stateHero.symbolIcon} color={colors.brand.violet} /></View>
        <Text style={styles.eyebrow}>{`YOU’RE INVITED TO A ${KIND[inv.planType].toUpperCase()}`}</Text>
        <Text style={styles.title}>{inv.planTitle}</Text>
        <Text style={styles.body}>{`${inv.inviterName} invited you. Open it to see the details and answer.`}</Text>
        <View style={styles.spacer} />
        <Button label="Open invitation" onPress={() => void open()} loading={busy} />
        <Button label="Not now" variant="ghost" onPress={() => router.replace('/(tabs)')} />
      </ScrollView>
    </Screen>
  );
}

const S = board.stateHero;
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingTop: S.paddingTop, paddingBottom: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  symbol: {
    width: S.symbolSize, height: S.symbolSize, borderRadius: S.symbolRadius, backgroundColor: S.symbolBackground,
    alignItems: 'center', justifyContent: 'center', marginBottom: S.symbolMarginBottom,
  },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, marginBottom: board.inlineGap },
  title: { ...board.h1, color: colors.brand.plum, marginBottom: board.inlineGap },
  body: { fontSize: S.bodySize, lineHeight: S.bodyLineHeight, color: colors.text.secondary },
});
