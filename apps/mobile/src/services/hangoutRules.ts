import type { Hangout, HangoutSuggestion, PlaceCategory } from './types';

/**
 * Pure Hangout rules shared by the mock service and the screens. UI simulation
 * rules for the mock frontend; the server owns the real ones later.
 */

/** Templates offered on the board (13 and H02) and the slots they plan, in order. */
export const HANGOUT_TEMPLATES: Record<string, string[]> = {
  Dinner: ['Dinner'],
  'Dinner + Dessert': ['Dinner', 'Dessert'],
  'Dinner + Activity': ['Dinner', 'Activity'],
  'Dinner + Activity + Dessert': ['Dinner', 'Activity', 'Dessert'],
  'Coffee + A walk': ['Coffee', 'A walk'],
  'Activity + Dinner': ['Activity', 'Dinner'],
};

/** Board 13 calls the three-slot template "Full Hangout". */
export const FULL_HANGOUT = 'Dinner + Activity + Dessert';
export const CREATE_TEMPLATES = ['Dinner', 'Dinner + Dessert', 'Dinner + Activity', FULL_HANGOUT];
export const EDIT_TEMPLATES = [FULL_HANGOUT, 'Coffee + A walk', 'Activity + Dinner'];

export function slotsFor(template: string): string[] {
  return HANGOUT_TEMPLATES[template] ?? template.split(' + ').map((s) => s.trim()).filter(Boolean);
}

/** Which Explore categories fit a slot, for the "Choose together" deck. */
export const SLOT_CATEGORIES: Record<string, PlaceCategory[]> = {
  Dinner: ['Food'],
  Dessert: ['Dessert'],
  Activity: ['Activities', 'Culture', 'Experiences', 'Nightlife'],
  Coffee: ['Coffee'],
  'A walk': ['Nature', 'Culture'],
};

/** The slot a place from Explore lands in: the first slot that fits its category, else the first slot. */
export function slotForCategory(template: string, category: PlaceCategory): string {
  const slots = slotsFor(template);
  return slots.find((s) => SLOT_CATEGORIES[s]?.includes(category)) ?? slots[0] ?? 'Suggestion';
}

/** Typical length of each slot, used only to space the mock timeline. */
const SLOT_MINUTES: Record<string, number> = { Dinner: 120, Activity: 105, Dessert: 60, Coffee: 60, 'A walk': 60 };
export const slotMinutes = (slot: string) => SLOT_MINUTES[slot] ?? 90;

/** `suggestedBy` for places Voya put forward in Choose together (board: "Voya suggestion"). */
export const VOYA_SUGGESTION = 'voya';

export const upVotes = (sg: HangoutSuggestion) => Object.values(sg.votes).filter((v) => v === 'up').length;

export function confirmedIds(h: Hangout): string[] {
  const inIds = (h.invites ?? []).filter((i) => i.status === 'in').map((i) => i.personId);
  return [h.ownerId, ...inIds.filter((id) => id !== h.ownerId)];
}

/** People counts for the lobby: everyone invited (organizer included) and how many are in. */
export function peopleCounts(h: Hangout) {
  const invites = h.invites ?? [];
  return { invited: 1 + invites.filter((i) => i.status !== 'declined').length, confirmed: confirmedIds(h).length };
}

export type SlotState = 'waiting' | 'voting' | 'chosen';

export interface SlotSummary {
  slot: string;
  suggestions: HangoutSuggestion[];
  /** Most up-voted suggestion; ties go to the earlier suggestion. */
  leader?: HangoutSuggestion;
  voted: number;
  of: number;
  state: SlotState;
}

/** Board 37 slot rows: "✓ Chosen", "2 of 4 voted", "Waiting · No decision yet". */
export function slotSummary(h: Hangout, slot: string): SlotSummary {
  const suggestions = h.suggestions.filter((s) => s.slot === slot);
  const leader = suggestions.reduce<HangoutSuggestion | undefined>(
    (best, s) => (!best || upVotes(s) > upVotes(best) ? s : best),
    undefined,
  );
  const voters = h.members.map((m) => m.personId);
  const voted = voters.filter((p) => suggestions.some((s) => s.votes[p] === 'up')).length;
  const state: SlotState = h.finalized || (suggestions.length > 0 && voted === voters.length && voters.length > 0)
    ? 'chosen'
    : suggestions.length === 0 ? 'waiting' : 'voting';
  return { slot, suggestions, leader, voted, of: voters.length, state };
}

/** The organizer may finalize once every slot has a suggestion with at least one vote. */
export function canFinalize(h: Hangout): boolean {
  return !h.finalized && slotsFor(h.template).every((slot) => {
    const { leader } = slotSummary(h, slot);
    return !!leader && upVotes(leader) > 0;
  });
}

/** The first slot that still needs a decision ("Choosing now"). */
export function currentSlot(h: Hangout): string | undefined {
  return slotsFor(h.template).find((slot) => slotSummary(h, slot).state !== 'chosen') ?? slotsFor(h.template)[0];
}
