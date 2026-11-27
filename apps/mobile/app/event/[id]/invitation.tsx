import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, LoadingState, Screen, TopBar } from '@/components/ui';
import { InvitationCard } from '@/features/event/Invitation';
import { useEvent } from '@/features/event/useEvent';

/**
 * 20 as its own route: hosts preview what guests see (EV01 "Invitation");
 * guests come here to change their answer.
 */
export default function EventInvitation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useEvent(id);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const event = h.event;
  if (!event || h.closed) return <Screen><TopBar /><EmptyState title="This invitation isn’t available" /></Screen>;
  const hh = { ...h, event };
  if (h.managing) return <InvitationCard h={hh} preview />;
  return (
    <InvitationCard
      h={hh}
      onAnswer={(rsvp) => void h.run(() => h.services.events.respond(event.id, rsvp)).then((ok) => {
        if (!ok) return;
        if (rsvp === 'going') router.replace(`/event/${event.id}/going`);
        else router.back();
      })}
      onDetails={() => router.back()}
    />
  );
}
