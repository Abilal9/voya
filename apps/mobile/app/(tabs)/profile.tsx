import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, ChevronRight, FlaskConical, History, LogOut } from 'lucide-react-native';
import { Avatar, Card, Divider, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { colors, icon, layout, spacing } from '@/theme';

/** 03 Profile. */
export default function Profile() {
  const router = useRouter();
  const services = useServices();
  const account = useSession((s) => s.account);
  const signOut = useSession((s) => s.signOut);

  const saved = useQuery({ queryKey: ['saved'], queryFn: () => services.saved.list() });
  const past = useQuery({ queryKey: ['plans', 'past'], queryFn: () => services.plans.listPast() });

  const rows = [
    { icon: Bookmark, label: 'Saved Places', value: `${saved.data?.length ?? 0}`, onPress: () => router.push('/saved') },
    { icon: History, label: 'Past Plans', value: `${past.data?.length ?? 0}`, onPress: () => router.push('/(tabs)') },
    { icon: FlaskConical, label: 'Developer menu', value: '', onPress: () => router.push('/dev') },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Avatar name={account?.displayName ?? 'Voya'} size={72} />
          <Text variant="h1">{account?.displayName ?? ''}</Text>
          <Text variant="footnote" tone="secondary">{account?.city}</Text>
        </View>

        <Card padded={false}>
          {rows.map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 ? <Divider inset={spacing.md} /> : null}
              <View style={styles.rowWrap}>
                <Text
                  variant="bodyLg"
                  onPress={row.onPress}
                  style={styles.rowLabel}
                  accessibilityRole="button"
                >
                  {row.label}
                </Text>
                <View style={styles.rowRight}>
                  {row.value ? <Text variant="footnote" tone="tertiary">{row.value}</Text> : null}
                  <ChevronRight size={icon.md} color={colors.text.tertiary} strokeWidth={icon.strokeWidth} />
                </View>
              </View>
            </React.Fragment>
          ))}
        </Card>

        <Card padded={false}>
          <View style={styles.rowWrap}>
            <Text
              variant="bodyLg"
              tone="danger"
              accessibilityRole="button"
              onPress={() => void signOut()}
              style={styles.rowLabel}
            >
              Log out
            </Text>
            <LogOut size={icon.md} color={colors.status.danger} strokeWidth={icon.strokeWidth} />
          </View>
        </Card>

        <Text variant="caption" tone="tertiary" center>
          Mock build · no real account, no backend, no provider calls.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  content: {
    paddingHorizontal: layout.screenPadding, paddingBottom: 140,
    gap: spacing.lg, paddingTop: spacing.md,
  },
  identity: { alignItems: 'center', gap: spacing.xxs },
  rowWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, minHeight: 56,
  },
  rowLabel: { flex: 1, paddingVertical: spacing.md },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
