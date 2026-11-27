import * as React from 'react';
import { ScrollView } from 'react-native';
import { LoadingState, Screen, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { GroupLabel, ToggleRow } from '@/features/settings/SettingsParts';
import { useSettings } from '@/features/settings/useSettings';
import type { NotificationKey } from '@/services';

const GROUPS: { label: string; items: { key: NotificationKey; title: string }[] }[] = [
  { label: 'Plans', items: [
    { key: 'newSuggestions', title: 'New suggestions' },
    { key: 'votesAndDecisions', title: 'Votes & decisions' },
    { key: 'planChanges', title: 'Plan changes' },
    { key: 'itineraryReady', title: 'Itinerary ready' },
  ] },
  { label: 'Invitations', items: [
    { key: 'newInvitations', title: 'New invitations' },
    { key: 'rsvpUpdates', title: 'RSVP updates' },
  ] },
  { label: 'During plans', items: [
    { key: 'upcomingActivities', title: 'Upcoming activities' },
    { key: 'scheduleChanges', title: 'Schedule changes' },
  ] },
  { label: 'Voya', items: [
    { key: 'recommendations', title: 'Recommendations' },
    { key: 'productUpdates', title: 'Product updates' },
  ] },
];

/**
 * V04 Notification settings. Preferences are saved per account. The mock
 * delivers no notifications; these will drive real push and email later.
 */
export default function NotificationSettings() {
  const settings = useSettings();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Settings" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Notifications" />
        {!settings.data ? (
          <LoadingState compact />
        ) : (
          GROUPS.map((g) => (
            <React.Fragment key={g.label}>
              <GroupLabel>{g.label}</GroupLabel>
              {g.items.map((item) => (
                <ToggleRow
                  key={item.key}
                  title={item.title}
                  value={settings.data!.notifications[item.key]}
                  onChange={(v) => settings.update({ notifications: { [item.key]: v } })}
                />
              ))}
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
