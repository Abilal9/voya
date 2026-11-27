import type {
  Account,
  AccountSettings,
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
  { id: 'p-ahmad', firstName: 'Ahmad', lastName: 'Bilal', displayName: 'Ahmad Bilal', city: 'Riyadh' },
  { id: 'p-khaled', firstName: 'Khaled', lastName: 'Kadri', displayName: 'Khaled Kadri', city: 'Riyadh' },
  { id: 'p-omar', firstName: 'Omar', lastName: 'Hassan', displayName: 'Omar Hassan', city: 'Riyadh' },
  { id: 'p-faisal', firstName: 'Faisal', lastName: 'Ahmed', displayName: 'Faisal Ahmed', city: 'Jeddah' },
  { id: 'p-nisreen', firstName: 'Nisreen', lastName: 'Bilal', displayName: 'Nisreen', city: 'Riyadh' },
];

export const account: Account = {
  ...(people[0] as Person),
  email: 'ahmad@example.com',
  onboardingStep: 'done',
  onboardingComplete: true,
  interests: ['Japanese food', 'Coffee', 'Culture', 'Outdoor activities'],
};

/** Explore category chips (E01). */
export const CATEGORIES = [
  'Food', 'Coffee', 'Dessert', 'Activities', 'Culture',
  'Shopping', 'Nature', 'Nightlife', 'Experiences',
] as const;

/** Taste interests from the board's onboarding (A08). */
export const TASTE_INTERESTS = [
  'Japanese food', 'Coffee', 'Fine dining', 'Culture', 'Museums', 'Outdoor activities',
  'Padel', 'Shopping', 'Dessert', 'Experiences', 'Hidden gems', 'Nature',
] as const;

export const CITIES = ['Riyadh', 'Jeddah', 'Dubai', 'Florence'] as const;

/** Mock "where you are": distances are measured from the selected city's centre. */
export const CITY_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  Riyadh: { latitude: 24.7136, longitude: 46.6753 },
  Jeddah: { latitude: 21.5433, longitude: 39.1728 },
  Dubai: { latitude: 25.2048, longitude: 55.2708 },
  Florence: { latitude: 43.7696, longitude: 11.2558 },
  London: { latitude: 51.5072, longitude: -0.1276 },
  Tokyo: { latitude: 35.6762, longitude: 139.6503 },
};

/** Board V04–V06 defaults: plan, invitation and in-plan alerts on; Voya news off. */
export const DEFAULT_SETTINGS: AccountSettings = {
  notifications: {
    newSuggestions: true, votesAndDecisions: true, planChanges: true, itineraryReady: true,
    newInvitations: true, rsvpUpdates: true,
    upcomingActivities: true, scheduleChanges: true,
    recommendations: false, productUpdates: false,
  },
  preciseLocation: true,
  discoveryRadiusKm: 15,
};

/** Cities Voya knows (E02). Only those in CITIES have fixture places. */
export const DESTINATIONS = [
  { city: 'Riyadh', country: 'Saudi Arabia' },
  { city: 'Jeddah', country: 'Saudi Arabia' },
  { city: 'Dubai', country: 'United Arab Emirates' },
  { city: 'Florence', country: 'Italy' },
  { city: 'London', country: 'United Kingdom' },
  { city: 'Tokyo', country: 'Japan' },
];

/** Board E02 "Somewhere to dream about". */
export const DREAM_DESTINATIONS = ['Tokyo'];

/** Board E02 "Recent destinations" for the seeded user. */
export const SEEDED_RECENT_CITIES = ['Dubai', 'Florence', 'London'];

/** Board E10 "Popular near you". */
export const POPULAR_SEARCHES = ['Japanese food', 'Museums', 'U Walk'] as const;

/** Board E10 "Recent searches" for the seeded user. */
export const SEEDED_RECENT_SEARCHES = ['Myazu', 'Coffee', 'Padel'];

export const places: Place[] = [
  // ---- Riyadh (healthy records)
  {
    id: 'myazu', name: 'Myazu', type: 'Japanese · Restaurant', category: 'Food',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.6, price: '$$$', photo: 'restaurant',
    reason: 'Because you like Japanese food and upscale restaurants',
    coordinates: { latitude: 24.6981, longitude: 46.6855 }, openNow: true,
    tags: ['Popular', 'Good for groups'],

    description: 'Contemporary Japanese dining, thoughtful details and a table worth sharing.', hoursText: 'Open until 12:00 AM',
  },
  {
    id: 'roka', name: 'ROKA', type: 'Japanese · Robatayaki', category: 'Food',
    city: 'Riyadh', area: 'Al Olaya', rating: 4.5, price: '$$$', photo: 'restaurant',
    reason: 'Highly rated near your area',
    coordinates: { latitude: 24.6943, longitude: 46.6836 },
    openNow: true, tags: ['Popular'],

    description: 'Robata grill and sharing plates in a lively, low-lit room.', hoursText: 'Open until 1:00 AM',
  },
  {
    id: 'urth', name: 'Urth Caffe', type: 'Coffee · Café', category: 'Coffee',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.5, price: '$$', photo: 'restaurant',
    reason: 'A little time for your next coffee discovery',
    coordinates: { latitude: 24.7021, longitude: 46.6712 }, openNow: true,

    description: 'Organic coffee, pastries and a sunny terrace for slow mornings.', hoursText: 'Open until 11:00 PM',
  },
  {
    id: 'hallab', name: 'Hallab', type: 'Lebanese sweets · Dessert', category: 'Dessert',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.5, price: '$$', photo: 'restaurant',
    reason: 'Something sweet to share after dinner',
    coordinates: { latitude: 24.6999, longitude: 46.6801 }, openNow: true,

    description: 'Lebanese sweets made the traditional way, from knafeh to maamoul.', hoursText: 'Open until 12:00 AM',
  },
  {
    id: 'finzione', name: 'Finzione', type: 'Italian · Restaurant', category: 'Food',
    city: 'Riyadh', area: 'As Sulimaniyah', rating: 4.4, price: '$$$', photo: 'restaurant',
    reason: 'A relaxed spot for your next dinner together',
    coordinates: { latitude: 24.6967, longitude: 46.6889 }, openNow: false,

    description: 'Seasonal Italian cooking with fresh pasta made in-house.', hoursText: 'Opens at 6:00 PM',
  },
  {
    id: 'padel-hub', name: 'The Padel Hub', type: 'Padel · Sports', category: 'Activities',
    city: 'Riyadh', area: 'Al Malqa', rating: 4.7, price: '$$', photo: 'activity',
    reason: 'Good for a group',
    coordinates: { latitude: 24.7812, longitude: 46.6301 },
    openNow: true, tags: ['Good for groups'],

    description: 'Indoor and outdoor padel courts with coaching and equipment hire.', hoursText: 'Open until 2:00 AM',
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

    description: 'Renaissance masterpieces from Botticelli, Leonardo and Michelangelo.', hoursText: 'Open until 6:30 PM',
  },
  {
    id: 'mercato', name: 'Mercato Centrale', type: 'Food hall · Market', category: 'Food',
    city: 'Florence', area: 'San Lorenzo', rating: 4.6, photo: 'restaurant',
    reason: 'A lively place to eat together',
    coordinates: { latitude: 43.7765, longitude: 11.2535 },
    openNow: true, tags: ['Good for groups'],

    description: 'A busy food hall with Tuscan stalls, fresh pasta and wine.', hoursText: 'Open until 12:00 AM',
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

    description: 'A historic café on Piazza della Repubblica, serving since 1733.',
  },
  // ---- DAMAGED: Florence, no rating/photo/price
  {
    id: 'santo-spirito', name: 'Piazza Santo Spirito', type: 'Square · Nightlife', category: 'Nightlife',
    city: 'Florence', area: 'Oltrarno',
    coordinates: { latitude: 43.7670, longitude: 11.2470 },
  },

  // ---- Florence, from the board's trip frames (07–11, 35, 36, T05, T06)
  {
    id: 'la-menagere', name: 'La Ménagère', type: 'Café · Restaurant', category: 'Food',
    city: 'Florence', area: 'San Lorenzo', rating: 4.4, price: '$$', photo: 'restaurant',
    coordinates: { latitude: 43.7766, longitude: 11.2557 },
  },
  {
    id: 'piazzale-michelangelo', name: 'Piazzale Michelangelo', type: 'Viewpoint · Nature', category: 'Nature',
    city: 'Florence', area: 'Oltrarno', rating: 4.8, photo: 'florence', tags: ['Popular'],
    coordinates: { latitude: 43.7629, longitude: 11.2650 },
    description: 'The terrace above the river with the view of the whole city.',
  },
  {
    id: 'boboli', name: 'Boboli Gardens', type: 'Gardens · Nature', category: 'Nature',
    city: 'Florence', area: 'Oltrarno', rating: 4.6, price: '$$', photo: 'florence',
    coordinates: { latitude: 43.7625, longitude: 11.2482 },
  },
  {
    id: 'pitti', name: 'Palazzo Pitti', type: 'Palace · Museum', category: 'Culture',
    city: 'Florence', area: 'Oltrarno', rating: 4.6, price: '$$', photo: 'uffizi',
    coordinates: { latitude: 43.7651, longitude: 11.2500 },
  },
  {
    id: 'accademia', name: "Galleria dell'Accademia", type: 'Gallery · Museum', category: 'Culture',
    city: 'Florence', area: 'San Marco', rating: 4.7, price: '$$', photo: 'uffizi', tags: ['Popular'],
    coordinates: { latitude: 43.7768, longitude: 11.2588 },
  },
  {
    id: 'ponte-vecchio', name: 'Ponte Vecchio', type: 'Bridge · Landmark', category: 'Culture',
    city: 'Florence', area: 'Historic Centre', rating: 4.8, photo: 'florence', tags: ['Popular'],
    coordinates: { latitude: 43.7680, longitude: 11.2531 },
  },
  {
    id: 'trattoria-mario', name: 'Trattoria Mario', type: 'Trattoria · Lunch', category: 'Food',
    city: 'Florence', area: 'San Lorenzo', rating: 4.5, price: '$', photo: 'restaurant',
    coordinates: { latitude: 43.7760, longitude: 11.2536 },
  },
  // ---- DAMAGED: no rating, photo or hours
  {
    id: 'san-lorenzo-market', name: 'Mercato di San Lorenzo', type: 'Street market · Shopping', category: 'Shopping',
    city: 'Florence', area: 'San Lorenzo',
    coordinates: { latitude: 43.7757, longitude: 11.2541 },
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
  id: 'plan-florence', type: 'trip', title: 'Florence', destination: 'Florence', country: 'Italy',
  city: 'Florence', lifecycle: 'active', ownerId: 'p-ahmad', version: 4,
  startDate: '2026-12-16', endDate: '2026-12-20',
  startsAt: iso('2026-12-16T00:00:00'), endsAt: iso('2026-12-20T23:59:00'),
  accommodation: 'Hotel Savoy, Florence, Italy',
  coverPhoto: 'florence', generated: true, mustDoPlaceIds: ['uffizi', 'duomo'],
  mustDoBy: { uffizi: ['p-ahmad'], duomo: ['p-khaled'] },
  invites: [
    { personId: 'p-khaled', status: 'joined', invitedBy: 'p-ahmad', invitedAt: iso('2026-10-02') },
    { personId: 'p-omar', status: 'joined', invitedBy: 'p-ahmad', invitedAt: iso('2026-10-02') },
    { personId: 'p-faisal', status: 'joined', invitedBy: 'p-ahmad', invitedAt: iso('2026-10-02') },
  ],
  preferences: {
    'p-ahmad': { interests: ['Food', 'Culture', 'Hidden gems'], pace: 'Balanced', discoveries: 'Mix', savedAt: iso('2026-10-04') },
    'p-khaled': { interests: ['Food', 'Museums'], pace: 'Balanced', discoveries: 'Iconic spots', savedAt: iso('2026-10-05') },
    'p-faisal': { interests: ['Nature', 'Food'], pace: 'Relaxed', discoveries: 'Mix', savedAt: iso('2026-10-06') },
    'p-omar': { interests: ['Nightlife', 'Food'], pace: 'Packed', discoveries: 'Hidden gems', savedAt: iso('2026-10-06') },
  },
  picks: {
    'p-ahmad': { uffizi: 'must', mercato: 'like', 'piazzale-michelangelo': 'like', 'santo-spirito': 'like' },
    'p-khaled': { duomo: 'must', uffizi: 'like', mercato: 'like', 'piazzale-michelangelo': 'like' },
    'p-faisal': { boboli: 'like', mercato: 'like', 'piazzale-michelangelo': 'like', uffizi: 'like' },
    'p-omar': { 'santo-spirito': 'like', mercato: 'like', 'piazzale-michelangelo': 'like', uffizi: 'skip' },
  },
  doneChoosing: ['p-ahmad', 'p-khaled', 'p-faisal'],
  members: [
    { personId: 'p-ahmad', role: 'organizer', capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'], joinedAt: iso('2026-10-02') },
    { personId: 'p-khaled', role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-10-03') },
    { personId: 'p-omar', role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-10-03') },
    { personId: 'p-faisal', role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-10-05') },
  ],
  // Wall times (no zone): the destination's clock. See TripItem.
  days: [
    {
      date: '2026-12-16', title: 'Hello, Florence',
      items: [
        { id: 'it-1', kind: 'meal', startsAt: '2026-12-16T09:00:00', endsAt: '2026-12-16T10:00:00', durationMinutes: 60, title: 'Breakfast', subtitle: 'La Ménagère', placeId: 'la-menagere' },
        { id: 'it-2', kind: 'activity', startsAt: '2026-12-16T10:30:00', endsAt: '2026-12-16T13:00:00', durationMinutes: 150, title: 'Uffizi Gallery', subtitle: '2h 30m', placeId: 'uffizi', locked: true },
        { id: 'it-3', kind: 'meal', startsAt: '2026-12-16T13:30:00', endsAt: '2026-12-16T14:45:00', durationMinutes: 75, title: 'Lunch', subtitle: 'Mercato Centrale', placeId: 'mercato' },
        { id: 'it-4', kind: 'activity', startsAt: '2026-12-16T15:30:00', endsAt: '2026-12-16T17:00:00', durationMinutes: 90, title: 'Piazza del Duomo', subtitle: 'Explore the square', placeId: 'duomo', locked: true },
        { id: 'it-5', kind: 'break', startsAt: '2026-12-16T18:00:00', endsAt: '2026-12-16T19:30:00', durationMinutes: 90, title: 'Hotel / break', subtitle: 'A little time to recharge' },
        { id: 'it-6', kind: 'meal', startsAt: '2026-12-16T20:30:00', endsAt: '2026-12-16T22:00:00', durationMinutes: 90, title: 'Dinner', subtitle: 'Santo Spirito', placeId: 'santo-spirito' },
      ],
    },
    {
      date: '2026-12-17', title: 'A little art. A lot of good food.',
      items: [
        { id: 'it-7', kind: 'meal', startsAt: '2026-12-17T09:00:00', endsAt: '2026-12-17T10:00:00', durationMinutes: 60, title: 'Breakfast', subtitle: 'Caffè Gilli', placeId: 'gilli' },
        { id: 'it-8', kind: 'activity', startsAt: '2026-12-17T10:30:00', endsAt: '2026-12-17T13:00:00', durationMinutes: 150, title: "Galleria dell'Accademia", subtitle: '2h 30m', placeId: 'accademia' },
        { id: 'it-9', kind: 'meal', startsAt: '2026-12-17T13:30:00', endsAt: '2026-12-17T14:45:00', durationMinutes: 75, title: 'Lunch', subtitle: 'Trattoria Mario', placeId: 'trattoria-mario' },
        { id: 'it-10', kind: 'meal', startsAt: '2026-12-17T20:30:00', endsAt: '2026-12-17T22:00:00', durationMinutes: 90, title: 'Dinner', subtitle: "Buca dell'Orafo", placeId: 'buca' },
      ],
    },
    {
      date: '2026-12-18', title: 'The slower route',
      items: [
        { id: 'it-11', kind: 'activity', startsAt: '2026-12-18T10:30:00', endsAt: '2026-12-18T12:00:00', durationMinutes: 90, title: 'Boboli Gardens', subtitle: '1h 30m', placeId: 'boboli' },
        { id: 'it-12', kind: 'activity', startsAt: '2026-12-18T15:30:00', endsAt: '2026-12-18T17:00:00', durationMinutes: 90, title: 'Piazzale Michelangelo', subtitle: '1h 30m', placeId: 'piazzale-michelangelo' },
      ],
    },
    { date: '2026-12-19', title: 'One last look', items: [] },
  ],
};

/** T05: a finished trip Ahmad went on. */
export const tuscanyWeekend: Trip = {
  id: 'plan-tuscany', type: 'trip', title: 'Tuscany Weekend', destination: 'Florence', country: 'Italy',
  city: 'Florence', lifecycle: 'completed', ownerId: 'p-khaled', version: 7,
  startDate: '2026-09-12', endDate: '2026-09-16',
  startsAt: iso('2026-09-12T00:00:00'), endsAt: iso('2026-09-16T23:59:00'),
  coverPhoto: 'florence', generated: true, mustDoPlaceIds: ['uffizi'], mustDoBy: { uffizi: ['p-khaled'] },
  invites: [
    { personId: 'p-ahmad', status: 'joined', invitedBy: 'p-khaled', invitedAt: iso('2026-08-01') },
    { personId: 'p-omar', status: 'joined', invitedBy: 'p-khaled', invitedAt: iso('2026-08-01') },
    { personId: 'p-faisal', status: 'joined', invitedBy: 'p-khaled', invitedAt: iso('2026-08-01') },
  ],
  preferences: {}, picks: {}, doneChoosing: [],
  members: [
    { personId: 'p-khaled', role: 'organizer', capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'], joinedAt: iso('2026-08-01') },
    { personId: 'p-ahmad', role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-08-02') },
    { personId: 'p-omar', role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-08-02') },
    { personId: 'p-faisal', role: 'traveler', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-08-03') },
  ],
  days: [
    { date: '2026-09-12', title: 'Hello, Florence', items: [{ id: 'tw-1', kind: 'meal', startsAt: '2026-09-12T20:30:00', title: 'Dinner', subtitle: 'Santo Spirito', placeId: 'santo-spirito' }] },
    { date: '2026-09-13', title: 'A little art. A lot of good food.', items: [
      { id: 'tw-2', kind: 'activity', startsAt: '2026-09-13T10:30:00', title: 'Uffizi Gallery', placeId: 'uffizi' },
      { id: 'tw-3', kind: 'meal', startsAt: '2026-09-13T13:30:00', title: 'Lunch', subtitle: 'Mercato Centrale', placeId: 'mercato' },
    ] },
    { date: '2026-09-14', title: 'The slower route', items: [
      { id: 'tw-4', kind: 'activity', startsAt: '2026-09-14T10:30:00', title: 'Boboli Gardens', placeId: 'boboli' },
      { id: 'tw-5', kind: 'activity', startsAt: '2026-09-14T15:30:00', title: 'Piazza del Duomo', placeId: 'duomo' },
    ] },
    { date: '2026-09-15', title: 'One last coffee', items: [{ id: 'tw-6', kind: 'meal', startsAt: '2026-09-15T09:00:00', title: 'Breakfast', subtitle: 'La Ménagère', placeId: 'la-menagere' }] },
  ],
};

export const fridayHangout: Hangout = {
  id: 'plan-friday', type: 'hangout', title: 'Friday Night', city: 'Riyadh',
  lifecycle: 'active', ownerId: 'p-ahmad', version: 7,
  startsAt: iso('2026-11-27T19:30:00'), template: 'Dinner + Activity + Dessert',
  finalized: false, coverPhoto: 'restaurant',
  members: [
    { personId: 'p-ahmad', role: 'organizer', capabilities: ['plan.edit', 'member.manage', 'invite.create', 'timeline.finalize', 'suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-20') },
    { personId: 'p-khaled', role: 'participant', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-20') },
    { personId: 'p-omar', role: 'participant', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-21') },
    { personId: 'p-faisal', role: 'participant', capabilities: ['suggestion.create', 'vote.cast'], joinedAt: iso('2026-11-21') },
  ],
  // Board 37 / H03: Khaled and Omar are in, Faisal is a maybe.
  invites: [
    { personId: 'p-khaled', status: 'in', invitedBy: 'p-ahmad', invitedAt: iso('2026-11-20') },
    { personId: 'p-omar', status: 'in', invitedBy: 'p-ahmad', invitedAt: iso('2026-11-20') },
    { personId: 'p-faisal', status: 'maybe', invitedBy: 'p-ahmad', invitedAt: iso('2026-11-20') },
  ],
  // Board 37: Dinner chosen (everyone voted), Activity 2 of 4 voted, Dessert waiting.
  suggestions: [
    { id: 'sg-1', placeId: 'myazu', slot: 'Dinner', suggestedBy: 'p-ahmad', votes: { 'p-ahmad': 'up', 'p-khaled': 'up', 'p-omar': 'up' } },
    { id: 'sg-2', placeId: 'roka', slot: 'Dinner', suggestedBy: 'p-khaled', votes: { 'p-khaled': 'up', 'p-faisal': 'up' } },
    { id: 'sg-3', placeId: 'padel-hub', slot: 'Activity', suggestedBy: 'p-omar', votes: { 'p-omar': 'up', 'p-faisal': 'up' } },
  ],
  timeline: [],
  changeRequests: [],
};

export const wedding: VoyaEvent = {
  id: 'plan-wedding', type: 'event', title: "Ahmad & Nisreen's Wedding",
  city: 'Riyadh', lifecycle: 'active', ownerId: 'p-ahmad', version: 11,
  startsAt: iso('2026-12-12T19:00:00'), endsAt: iso('2026-12-13T01:00:00'),
  venue: 'Four Seasons Riyadh', coverPhoto: 'wedding',
  description: 'Join us for an evening with the people we love.',
  dressCode: 'Formal',
  note: 'Please arrive by 7:30 PM.',
  invitation: { eyebrow: 'Together with their families', headline: 'Ahmad & Nisreen', line: 'are getting married' },
  cohostPermissions: { details: false, guests: true, schedule: true },
  members: [
    { personId: 'p-ahmad', role: 'host', capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'schedule.edit'], joinedAt: iso('2026-09-01') },
    { personId: 'p-nisreen', role: 'host', capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'schedule.edit'], joinedAt: iso('2026-09-01') },
  ],
  guests: [
    { id: 'g-khaled', personId: 'p-khaled', displayName: 'Khaled Kadri', rsvp: 'going', invitedBy: 'p-ahmad', invitedAt: iso('2026-10-01') },
    { id: 'g-omar', personId: 'p-omar', displayName: 'Omar Hassan', rsvp: 'going', invitedBy: 'p-ahmad', invitedAt: iso('2026-10-01') },
    { id: 'g-faisal', personId: 'p-faisal', displayName: 'Faisal Ahmed', rsvp: 'pending', invitedBy: 'p-ahmad', invitedAt: iso('2026-10-01') },
    { id: 'g-stranger', displayName: 'Sarah Ali', rsvp: 'maybe', invitedBy: 'p-nisreen', invitedAt: iso('2026-10-02') },
  ],
  schedule: [
    { id: 'ev-1', startsAt: iso('2026-12-12T19:00:00'), endsAt: iso('2026-12-12T20:00:00'), title: 'Guest arrival', location: 'Main Ballroom Entrance', subtitle: 'Main Ballroom Entrance', visibility: 'all_guests' },
    { id: 'ev-2', startsAt: iso('2026-12-12T20:00:00'), endsAt: iso('2026-12-12T21:30:00'), title: 'Dinner', location: 'Grand Ballroom', subtitle: 'Grand Ballroom', visibility: 'all_guests' },
    { id: 'ev-3', startsAt: iso('2026-12-12T21:30:00'), endsAt: iso('2026-12-12T23:15:00'), title: 'Dancing', visibility: 'all_guests' },
    // Host-only. Must never appear in guestProjection().
    { id: 'ev-5', startsAt: iso('2026-12-12T22:45:00'), title: 'Photographer briefing', visibility: 'hosts_only' },
    {
      id: 'ev-4', startsAt: iso('2026-12-12T23:15:00'), endsAt: iso('2026-12-12T23:30:00'), title: 'Bride & groom entrance',
      instructions: 'Please be seated by 11:05 PM', subtitle: 'Please be seated by 11:05 PM', visibility: 'all_guests',
    },
    { id: 'ev-6', startsAt: iso('2026-12-12T23:30:00'), endsAt: iso('2026-12-13T00:00:00'), title: 'Cake & photographs', visibility: 'all_guests' },
    { id: 'ev-7', startsAt: iso('2026-12-13T00:00:00'), title: 'Celebration continues', visibility: 'all_guests' },
  ],
};

/** EV05: a finished event Ahmad attended as a guest. */
export const graduationDinner: VoyaEvent = {
  id: 'plan-graduation', type: 'event', title: 'Faisal’s Graduation Dinner',
  city: 'Riyadh', lifecycle: 'completed', ownerId: 'p-faisal', version: 9,
  startsAt: iso('2026-06-20T19:00:00'), endsAt: iso('2026-06-20T23:00:00'),
  venue: 'Four Seasons Riyadh', coverPhoto: 'wedding',
  cohostPermissions: { details: false, guests: true, schedule: true },
  members: [
    { personId: 'p-faisal', role: 'host', capabilities: ['plan.edit', 'plan.delete', 'member.manage', 'invite.create', 'schedule.edit'], joinedAt: iso('2026-05-20') },
  ],
  guests: [
    { id: 'gg-ahmad', personId: 'p-ahmad', displayName: 'Ahmad Bilal', rsvp: 'going', invitedBy: 'p-faisal', invitedAt: iso('2026-05-21') },
    { id: 'gg-khaled', personId: 'p-khaled', displayName: 'Khaled Kadri', rsvp: 'going', invitedBy: 'p-faisal', invitedAt: iso('2026-05-21') },
    { id: 'gg-omar', personId: 'p-omar', displayName: 'Omar Hassan', rsvp: 'maybe', invitedBy: 'p-faisal', invitedAt: iso('2026-05-21') },
  ],
  schedule: [
    { id: 'gd-1', startsAt: iso('2026-06-20T19:00:00'), title: 'Guest arrival', location: 'Main Ballroom', subtitle: 'Main Ballroom', visibility: 'all_guests' },
    { id: 'gd-2', startsAt: iso('2026-06-20T20:00:00'), title: 'Dinner', location: 'Grand Ballroom', subtitle: 'Grand Ballroom', visibility: 'all_guests' },
    { id: 'gd-3', startsAt: iso('2026-06-20T21:00:00'), title: 'Graduation toast', notes: 'A night to remember', subtitle: 'A night to remember', visibility: 'all_guests' },
  ],
};

export const completedHangout: Hangout = {
  id: 'plan-past-hangout', type: 'hangout', title: 'Padel & Dinner', city: 'Riyadh',
  lifecycle: 'completed', ownerId: 'p-khaled', version: 12, template: 'Dinner + Activity',
  startsAt: iso('2026-10-24T18:00:00'), finalized: true, suggestions: [], changeRequests: [],
  invites: [{ personId: 'p-ahmad', status: 'in', invitedBy: 'p-khaled', invitedAt: iso('2026-10-18') }],
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

export const plans = [florenceTrip, fridayHangout, wedding, completedHangout, graduationDinner, tuscanyWeekend];

/** Seeded plan ids before the shared world tracked them (see store normalizeWorld). */
export const ORIGINAL_PLAN_IDS = ['plan-florence', 'plan-friday', 'plan-wedding', 'plan-past-hangout'];

export const INVITE_TOKENS = {
  validHangout: 'inv-friday-night',
  validEvent: 'inv-wedding',
  validTrip: 'inv-florence',
  expired: 'inv-expired',
  revoked: 'inv-revoked',
} as const;
