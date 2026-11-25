import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { Button, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/** A05 Reset link sent. */
export default function ResetSent() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.body}>
        <MailCheck size={40} color={colors.brand.violet} strokeWidth={1.7} />
        <Text variant="h1" center>Check your email</Text>
        <Text variant="body" tone="secondary" center>
          We sent a password reset link to your inbox. No email is actually sent in the mock.
        </Text>
      </View>
      <Button label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingHorizontal: spacing.lg,
  },
});
