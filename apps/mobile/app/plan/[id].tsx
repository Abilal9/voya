import * as React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, Screen, TopBar } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';

/**
 * Older links (`/plan/<id>`) from Activity and Past Plans. Every plan type has
 * its own screens now, so this only sends people to the right one.
 */
export default function PlanRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const services = useServices();
  const plan = useQuery({ queryKey: ['plan', id], queryFn: () => services.plans.get(id!) });
  if (plan.isPending) return <Screen><LoadingState /></Screen>;
  if (plan.isError || !plan.data) return <Screen><TopBar /><ErrorState onRetry={() => void plan.refetch()} error={plan.error} /></Screen>;
  return <Redirect href={`/${plan.data.type}/${plan.data.id}` as never} />;
}
