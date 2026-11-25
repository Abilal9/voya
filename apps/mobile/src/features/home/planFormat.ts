import type { Plan } from '@/services';

export const PLAN_LABEL: Record<Plan['type'], string> = {
  trip: 'Trip',
  hangout: 'Hangout',
  event: 'Event',
};

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Up Next meta, board style: "Friday · 7:30 PM". */
export function shortWhen(plan: Plan) {
  if (!plan.startsAt) return 'Dates to be decided';
  const start = new Date(plan.startsAt);
  if (plan.type === 'trip' && plan.endsAt) return rangeLabel(start, new Date(plan.endsAt));
  return `${start.toLocaleDateString(undefined, { weekday: 'long' })} · ${time(start)}`;
}

function rangeLabel(start: Date, end: Date) {
  const month = start.toLocaleDateString(undefined, { month: 'short' });
  if (start.getMonth() === end.getMonth()) return `${month} ${start.getDate()}–${end.getDate()}`;
  const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
  return `${month} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

/** Upcoming row subtitle, board style: "Saturday, 12 December · Event" / "Nov 18–22 · Trip". */
export function rowWhen(plan: Plan) {
  const label = PLAN_LABEL[plan.type];
  if (!plan.startsAt) return `Dates to be decided · ${label}`;
  const start = new Date(plan.startsAt);
  if (plan.type === 'trip' && plan.endsAt) return `${rangeLabel(start, new Date(plan.endsAt))} · ${label}`;
  const day = start.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day} · ${label}`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
