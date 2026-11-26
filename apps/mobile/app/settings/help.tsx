import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { SettingsRow } from '@/features/settings/SettingsParts';
import { SUPPORT_EMAIL, appVersion, emailSupport } from '@/features/settings/support';
import { board, colors } from '@/theme';

/**
 * V07 Help & Support. Report a problem, Contact support and Give feedback
 * open a mail draft to support@voya.events. The Help Center is not published
 * yet, so its row says so instead of opening nothing.
 */
export default function Help() {
  const [noMail, setNoMail] = React.useState(false);
  const write = async (subject: string) => setNoMail(!(await emailSupport(subject)));

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Help & Support" />
        <SettingsRow title="Help Center" subtitle="Published before launch" />
        <SettingsRow title="Report a problem" onPress={() => void write('Problem report')} />
        <SettingsRow title="Contact support" onPress={() => void write('Support request')} />
        <SettingsRow title="Give feedback" onPress={() => void write('Feedback')} />
        {noMail ? (
          <Text style={styles.note} accessibilityRole="alert">
            {`No mail app is set up on this device. You can reach us at ${SUPPORT_EMAIL}.`}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <Text style={styles.small}>App version</Text>
        <Text style={styles.small}>{`Voya ${appVersion()}`}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  note: { ...board.small, color: colors.text.secondary, marginTop: board.listRow.paddingY },
  small: { ...board.small, color: colors.text.secondary },
});
