import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { VoyaLogo } from '@/components/brand';
import { Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { SettingsRow } from '@/features/settings/SettingsParts';
import { appVersion } from '@/features/settings/support';
import { board, colors } from '@/theme';

const A = board.settings.about;

/**
 * V08 About Voya. The version is the real app config version. Terms,
 * Privacy and Licenses are not published yet, so they say so rather than
 * linking to pages that do not exist.
 */
export default function About() {
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="About Voya" />
        <View style={styles.about}>
          <View style={styles.logo}>
            <VoyaLogo width={A.logoWidth} />
          </View>
          <Text style={styles.tagline}>Plan less. Live more.</Text>
          <Text style={styles.small}>{`Voya ${appVersion()}`}</Text>
        </View>
        <View style={styles.spacer} />
        <SettingsRow title="Terms" subtitle="Published before launch" />
        <SettingsRow title="Privacy" subtitle="Published before launch" />
        <SettingsRow title="Licenses" subtitle="Published before launch" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  about: { marginTop: A.marginTop - board.form.fieldsMarginTop },
  logo: { marginBottom: A.logoMarginBottom },
  tagline: { fontSize: A.taglineSize, color: colors.brand.plum, marginBottom: A.taglineMarginBottom / 2 },
  small: { ...board.small, color: colors.text.secondary },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
});
