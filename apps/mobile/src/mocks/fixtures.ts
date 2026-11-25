import type {
  Account,
  ActivityEntry,
  Hangout,
  Person,
  Place,
  Trip,
  VoyaEvent,
} from '@/services/types';

/**
 * One coherent fixture graph.
 *
 * Content is taken from the frozen design (reference/voya-design.html): the same
 * people, places, dates and times appear on the board. People are consistent
 * across every plan; plan items reference real place ids.
 *
 * ~35% of places are DELIBERATELY DAMAGED — missing rating, missing photo,
 * unknown hours, permanently closed, very long Arabic name — so that screens are
 * built against the shape of real provider data rather than a tidy ideal.
 */

export const SIGNED_IN_ACCOUNT_ID = 'p-ahmad';

/**
 * The "today" the fixture graph was authored against. When state is seeded the
 * store shifts every fixture timestamp forward by whole weeks so that, relative
 * to the real clock, upcoming plans are still upcoming and weekdays still match
 * the board (Friday Night stays a Friday). After seeding, persisted dates age
 * normally, so a plan whose dates pass moves to Past Plans.
 *
 * Board note: the board labels the Florence trip "Nov 18–22". It is authored
 * here as Dec 16–20 (same weekdays) so it sits after the Wedding as it does in
 * the board's Upcoming list, instead of being a past trip shown as upcoming.
 */
export const FIXTURE_ANCHOR = '2026-11-25T12:00:00';

export const people: Person[] = [
  { id: 'p-ahmad', firstName: 'Ahmad', displayName: 'Ahmad', city: 'Riyadh' },
  { id: 'p-khaled', firstName: 'Khaled', lastName: 'Kadri', displayName: 'Khaled Kadri', city: 'Riyadh' },
  { id: 'p-omar', firstName: 'Omar', lastName: 'Hassan', displayName: 'Omar Hassan', city: 'Riyadh' },
  { id: 'p-faisal', firstName: 'Faisal', lastName: 'Ahmed', displayName: 'Faisal Ahmed', city: 'Jeddah' },
  { id: 'p-nisreen', firstName: 'Nisreen', displayName: 'Nisreen', city: 'Riyadh' },
];

export const account: Account = {
  ...(people[0] as Person),
  email: 'ahmad@example.com',
  onboardingStep: 'done',
  onboardingComplete: true,
  interests: ['Food', 'Coffee', 'Culture', 'Experiences'],
};

export const INTERESTS = [
  'Food', 'Coffee', 'Dessert', 'Activities', 'Culture',
  'Shopping', 'Nature', 'Nightlife', 'Experiences',
] as const;

export const CITIES = ['Riyadh', 'Jeddah', 'Dubai', 'Florence'] as const;

export const places: Place[] = [
  // ---- Riyadh (healthy records)
  {
    id: 'myazu', name: 'Myazu', type: 'Japanese · Restaurant', category: 'Food',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.6, price: '$$$', photo: 'restaurant',
    reason: 'Because you like Japanese food and upscale restaurants',
    coordinates: { latitude: 24.6981, longitude: 46.6855 }, openNow: true,
    tags: ['Popular', 'Good for groups'],
  },
  {
    id: 'roka', name: 'ROKA', type: 'Japanese · Robatayaki', category: 'Food',
    city: 'Riyadh', area: 'Al Olaya', rating: 4.5, price: '$$$', photo: 'restaurant',
    reason: 'Highly rated near your area',
    coordinates: { latitude: 24.6943, longitude: 46.6836 },
    openNow: true, tags: ['Popular'],
  },
  {
    id: 'urth', name: 'Urth Caffe', type: 'Coffee · Café', category: 'Coffee',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.5, price: '$$', photo: 'restaurant',
    reason: 'A little time for your next coffee discovery',
    coordinates: { latitude: 24.7021, longitude: 46.6712 }, openNow: true,
  },
  {
    id: 'hallab', name: 'Hallab', type: 'Lebanese sweets · Dessert', category: 'Dessert',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.5, price: '$$', photo: 'restaurant',
    reason: 'Something sweet to share after dinner',
    coordinates: { latitude: 24.6999, longitude: 46.6801 }, openNow: true,
  },
  {
    id: 'finzione', name: 'Finzione', type: 'Italian · Restaurant', category: 'Food',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.4, price: '$$$', photo: 'restaurant',
    reason: 'A relaxed spot for your next dinner together',
    coordinates: { latitude: 24.6967, longitude: 46.6889 }, openNow: false,
  },
  {
    id: 'padel-hub', name: 'The Padel Hub', type: 'Padel · Sports', category: 'Activities',
    city: 'Riyadh', area: 'Al Malqa', rating: 4.7, price: '$$', photo: 'activity',
    reason: 'Liked by 3 of 4 friends',
    coordinates: { latitude: 24.7812, longitude: 46.6301 },
    openNow: true, tags: ['Good for groups'],
  },

  // ---- DAMAGED: no price, hours unknown (undefined !== closed)
  {
    id: 'somewhere', name: 'Somewhere', type: 'Dessert · Café', category: 'Dessert',
    city: 'Riyadh', area: 'Al Olaya', rating: 4.7, photo: 'restaurant',
    reason: 'Near your selected area',
    coordinates: { latitude: 24.6905, longitude: 46.6855 },
  },
  // ---- DAMAGED: no rating, no photo
  {
    id: 'nofa-majlis', name: 'Nofa Majlis', type: 'Traditional · Restaurant', category: 'Food',
    city: 'Riyadh', area: 'Diriyah', price: '$$',
    reason: 'A new discovery for your next day out',
    coordinates: { latitude: 24.7369, longitude: 46.5752 },
  },
  // ---- DAMAGED: very long Arabic name, no rating, no price, no photo
  {
    id: 'ar-long',
    name: 'مقهى الروشن التراثي للقهوة العربية والحلويات الشعبية',
    type: 'قهوة · مقهى', category: 'Coffee', city: 'Riyadh', area: 'Al Bujairi',
    coordinates: { latitude: 24.7336, longitude: 46.5754 },
  },
  // ---- DAMAGED: permanently closed
  {
    id: 'closed-cafe', name: 'Elm & Oak', type: 'Coffee · Café', category: 'Coffee',
    city: 'Riyadh', area: 'Al Olaya', rating: 4.1, price: '$$', photo: 'restaurant',
    permanentlyClosed: true,
    coordinates: { latitude: 24.6889, longitude: 46.6721 },
  },

  // ---- Florence
  {
    id: 'uffizi', name: 'Uffizi Gallery', type: 'Museum · Culture', category: 'Culture',
    city: 'Florence', area: 'Historic Centre', rating: 4.8, price: '$$', photo: 'uffizi',
    reason: 'Great match for you',
    coordinates: { latitude: 43.7678, longitude: 11.2559 },
    openNow: true, tags: ['Popular'],
  },
  {
    id: 'mercato', name: 'Mercato Centrale', type: 'Food hall · Market', category: 'Food',
    city: 'Florence', area: 'San Lorenzo', rating: 4.6, photo: 'restaurant',
    reason: 'Liked by 3 of 4 travelers',
    coordinates: { latitude: 43.7765, longitude: 11.2535 },
    openNow: true, tags: ['Good for groups'],
  },
  {
    id: 'duomo', name: 'Piazza del Duomo', type: 'Landmark · Culture', category: 'Culture',
    city: 'Florence', area: 'Historic Centre', rating: 4.9, photo: 'florence',
    reason: 'A must-see in Florence',
    coordinates: { latitude: 43.7731, longitude: 11.2560 },
  },
  {
    id: 'savoy', name: 'Hotel Savoy', type: 'Hotel · Stay', category: 'Experiences',
    city: 'Florence', area: 'Piazza della Repubblica', rating: 4.7, price: '$$$', photo: 'florence',
    coordinates: { latitude: 43.7714, longitude: 11.2542 },
  },
  {
    id: 'buca', name: "Buca dell'Orafo", type: 'Restaurant · Dining', category: 'Food',
    city: 'Florence', area: 'Historic Centre', rating: 4.5, price: '$$', photo: 'restaurant',
    reason: 'A new discovery for your next day out',
    coordinates: { latitude: 43.7684, longitude: 11.2531 },
  },
  {
    id: 'gilli', name: 'Caffè Gilli', type: 'Coffee · Café', category: 'Coffee',
    city: 'Florence', area: 'Piazza della Repubblica', rating: 4.5, price: '$$', photo: 'restaurant',
    reason: 'A new discovery for your next day out',
    coordinates: { latitude: 43.7719, longitude: 11.2546 },
  },
  // ---- DAMAGED: Florence, no rating/photo/price
  {
    id: 'santo-spirito', name: 'Piazza Santo Spirito', type: 'Square · Nightlife', category: 'Nightlife',
    city: 'Florence', area: 'Oltrarno',
    coordinates: { latitude: 43.7670, longitude: 11.2470 },
  },

  // ---- Dubai
  {
    id: 'dubai-arts', name: 'Alserkal Avenue', type: 'Galleries · Culture', category: 'Culture',
    city: 'Dubai', area: 'Al Quoz', rating: 4.6, photo: 'activity',
    reason: 'Matches your culture interests',
    coordinates: { latitude: 25.1412, longitude: 55.2295 }, openNow: true,
  },
  {
    id: 'dubai-coffee', name: 'Nightjar Coffee', type: 'Coffee · Roastery', category: 'Coffee',
    city: 'Dubai', area: 'Al Quoz', rating: 4.7, price: '$$', photo: 'restaurant',
    coordinates: { latitude: 25.1398, longitude: 55.2271 },
  },
];

const iso = (d: string) => new Date(d).toISOString();

export const florenceTrip: Trip = {
  id: 'plan-florence', type: 'trip', title: 'Florence', destination: 'Florence',
  city: 'Florence', lifecycle: 'active', ownerId: 'p-ahmad', version: 4,
  startsAt: iso('2026-12-16T09:00:00'), endsAt: iso('2026-12-20T20:00:00'),
  coverPhoto: 'florence', generated: true, mustDoPlaceIds: ['uffizi', 'duomo'],
  members: [
    { personId: 'p-ahmad', role: 'organizer', capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create'], joinedAt: iso('2026-10-02') },
    { personId: 'p-khaled', role: 'traveler', capabilities: ['vote.cast'], joinedAt: iso('2026-10-03') },
    { personId: 'p-omar', role: 'traveler', capabilities: ['vote.cast'], joinedAt: iso('2026-10-03') },
    { personId: 'p-faisal', role: 'traveler', capabilities: ['vote.cast'], joinedAt: iso('2026-10-05') },
  ],
  days: [
    {
      date: '2026-12-16',
      items: [
        { id: 'it-1', startsAt: iso('2026-12-16T10:00:00'), title: 'Uffizi Gallery', subtitle: 'Museum · Culture', placeId: 'uffizi', locked: true, travelMinutes: 0 },
        { id: 'it-2', startsAt: iso('2026-12-16T13:00:00'), title: 'Mercato Centrale', subtitle: 'Lunch', placeId: 'mercato', travelMinutes: 12 },
        { id: 'it-3', startsAt: iso('2026-12-16T18:00:00'), title: 'Hotel / break', subtitle: 'A little time to recharge', placeId: 'savoy', travelMinutes: 9 },
        { id: 'it-4', startsAt: iso('2026-12-16T20:30:00'), title: 'Dinner', subtitle: 'Santo Spirito', placeId: 'santo-spirito', travelMinutes: 14 },
      ],
    },
    {
      date: '2026-12-17',
      items: [
        { id: 'it-5', startsAt: iso('2026-12-17T09:30:00'), title: 'Caffè Gilli', subtitle: 'Breakfast', placeId: 'gilli' },
        { id: 'it-6', startsAt: iso('2026-12-17T11:00:00'), title: 'Piazza del Duomo', subtitle: 'Landmark', placeId: 'duomo', locked: true, travelMinutes: 6 },
        { id: 'it-7', startsAt: iso('2026-12-17T19:30:00'), title: "Buca dell'Orafo", subtitle: 'Dinner', placeId: 'buca', travelMinutes: 10 },
      ],
    },
  ],
};

export const fridayHangout: Hangout = {
  id: 'plan-friday', type: 'hangout', title: 'Friday Night', city: 'Riyadh',
  lifecycle: 'active', ownerId: 'p-ahmad', version: 7,
  startsAt: iso('2026-11-27T19:30:00'), template: 'Dinner + Dessert',
  finalized: false, coverPhoto: 'restaurant',
  members: [
    { personId: 'p-ahmad', role: 'organizer', capabilities: ['plan.edit', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-20') },
    { personId: 'p-khaled', role: 'participant', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-20') },
    { personId: 'p-omar', role: 'participant', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-21') },
    { personId: 'p-faisal', role: 'participant', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-21') },
  ],
  suggestions: [
    { id: 'sg-1', placeId: 'myazu', slot: 'Dinner', suggestedBy: 'p-ahmad', votes: { 'p-ahmad': 'up', 'p-khaled': 'up', 'p-omar': 'up' } },
    { id: 'sg-2', placeId: 'roka', slot: 'Dinner', suggestedBy: 'p-khaled', votes: { 'p-khaled': 'up' } },
    { id: 'sg-3', placeId: 'somewhere', slot: 'Dessert', suggestedBy: 'p-omar', votes: { 'p-omar': 'up', 'p-ahmad': 'up' } },
    { id: 'sg-4', placeId: 'hallab', slot: 'Dessert', suggestedBy: 'p-faisal', votes: { 'p-faisal': 'up' } },
  ],
  timeline: [
    { id: 'tl-1', startsAt: iso('2026-11-27T19:30:00'), title: 'Dinner', subtitle: 'Myazu', placeId: 'myazu' },
    { id: 'tl-2', startsAt: iso('2026-11-27T21:30:00'), title: 'Dessert', subtitle: 'Somewhere', placeId: 'somewhere', travelMinutes: 9 },
    { id: 'tl-3', startsAt: iso('2026-11-27T23:15:00'), title: 'Padel', subtitle: 'The Padel Hub', placeId: 'padel-hub', travelMinutes: 9 },
  ],
};

export const wedding: VoyaEvent = {
  id: 'plan-wedding', type: 'event', title: "Ahmad & Nisreen's Wedding",
  city: 'Riyadh', lifecycle: 'active', ownerId: 'p-ahmad', version: 11,
  startsAt: iso('2026-12-12T19:00:00'), endsAt: iso('2026-12-13T01:00:00'),
  venue: 'Al Faisaliah Ballroom', coverPhoto: 'wedding',
  description: 'Together makes a more beautiful tomorrow.',
  dressCode: 'Formal',
  members: [
    { personId: 'p-ahmad', role: 'host', capabilities: ['plan.edit', 'member.manage', 'invite.create', 'schedule.edit'], joinedAt: iso('2026-09-01') },
    { personId: 'p-nisreen', role: 'co-host', capabilities: ['plan.edit', 'schedule.edit'], joinedAt: iso('2026-09-01') },
  ],
  guests: [
    { id: 'g-khaled', personId: 'p-khaled', displayName: 'Khaled Kadri', rsvp: 'going' },
    { id: 'g-omar', personId: 'p-omar', displayName: 'Omar Hassan', rsvp: 'going' },
    { id: 'g-faisal', personId: 'p-faisal', displayName: 'Faisal Ahmed', rsvp: 'maybe' },
    { id: 'g-stranger', displayName: 'Salma Rahman', rsvp: 'pending' },
  ],
  schedule: [
    { id: 'ev-1', startsAt: iso('2026-12-12T19:00:00'), title: 'Doors open', visibility: 'all_guests' },
    { id: 'ev-2', startsAt: iso('2026-12-12T20:00:00'), title: 'Dinner served', visibility: 'all_guests' },
    { id: 'ev-3', startsAt: iso('2026-12-12T21:30:00'), title: 'Dancing', visibility: 'all_guests' },
    {
      id: 'ev-4', startsAt: iso('2026-12-12T23:15:00'), title: 'Bride & groom entrance',
      subtitle: 'Please be seated by 11:05 PM', visibility: 'all_guests',
    },
    // Host-only. Must never appear in guestProjection().
    { id: 'ev-5', startsAt: iso('2026-12-12T22:45:00'), title: 'Photographer briefing', visibility: 'hosts_only' },
  ],
};

export const completedHangout: Hangout = {
  id: 'plan-past-hangout', type: 'hangout', title: 'Padel & Dinner', city: 'Riyadh',
  lifecycle: 'completed', ownerId: 'p-khaled', version: 12, template: 'Dinner + Activity',
  startsAt: iso('2026-10-24T18:00:00'), finalized: true, suggestions: [],
  members: [
    { personId: 'p-khaled', role: 'organizer', capabilities: ['plan.edit'], joinedAt: iso('2026-10-18') },
    { personId: 'p-ahmad', role: 'participant', capabilities: ['vote.cast'], joinedAt: iso('2026-10-18') },
  ],
  timeline: [
    { id: 'pt-1', startsAt: iso('2026-10-24T18:00:00'), title: 'Padel', subtitle: 'The Padel Hub', placeId: 'padel-hub' },
    { id: 'pt-2', startsAt: iso('2026-10-24T20:30:00'), title: 'Dinner', subtitle: 'Finzione', placeId: 'finzione' },
  ],
};

export const activity: ActivityEntry[] = [
  { id: 'ac-1', actorId: 'p-khaled', planId: 'plan-friday', type: 'vote', message: 'Khaled voted on Friday Night', createdAt: iso('2026-11-24T18:20:00') },
  { id: 'ac-2', actorId: 'p-faisal', planId: 'plan-florence', type: 'join', message: 'Faisal joined the Florence trip', createdAt: iso('2026-11-23T11:02:00') },
  { id: 'ac-3', actorId: 'p-omar', planId: 'plan-wedding', type: 'rsvp', message: 'Omar is going to the wedding', createdAt: iso('2026-11-22T09:14:00'), readAt: iso('2026-11-22T10:00:00') },
];

export const plans = [florenceTrip, fridayHangout, wedding, completedHangout];

export const INVITE_TOKENS = {
  validHangout: 'inv-friday-night',
  validEvent: 'inv-wedding',
  expired: 'inv-expired',
  revoked: 'inv-revoked',
} as const;
