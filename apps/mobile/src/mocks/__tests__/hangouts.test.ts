import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockServices as services } from '../services';
import { resetAll, simulation } from '../store';
import { canFinalize, confirmedIds, peopleCounts, slotSummary, slotsFor } from '@/services/hangoutRules';
import type { Hangout } from '@/services';

const soon = () => new Date(Date.now() + 3 * 86400000).toISOString();
const as = (who: string) => services.auth.signIn(`${who}@example.com`, 'x');
const hangout = async (id: string) => {
  const p = await services.plans.get(id);
  if (p.type !== 'hangout') throw new Error('expected hangout');
  return p;
};

function restart(): typeof services {
  let fresh!: typeof services;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', () => AsyncStorage);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module copy is the point
    fresh = require('../services').mockServices;
  });
  return fresh;
}

beforeEach(async () => {
  simulation.latencyMs = 0;
  await resetAll();
});

describe('create', () => {
  it('creates a shared hangout with the creator as organizer and pending invites', async () => {
    await as('ahmad');
    const h = await services.plans.createHangout({
      title: '  Thursday Padel ', city: 'Riyadh', template: 'Dinner + Activity', startsAt: soon(), invitees: ['p-khaled', 'p-omar', 'p-khaled', 'p-ahmad'],
    });
    expect(h.title).toBe('Thursday Padel');
    expect(h.members).toEqual([expect.objectContaining({ personId: 'p-ahmad', role: 'organizer' })]);
    expect((h.invites ?? []).map((i) => [i.personId, i.status])).toEqual([['p-khaled', 'pending'], ['p-omar', 'pending']]);
    expect(peopleCounts(h)).toEqual({ invited: 3, confirmed: 1 });
    expect((await services.plans.listUpcoming()).map((p) => p.id)).toContain(h.id);
  });

  it('rejects a missing name, an invalid date and an unknown template', async () => {
    await as('ahmad');
    await expect(services.plans.createHangout({ title: ' ', city: 'Riyadh', template: 'Dinner', startsAt: soon() })).rejects.toMatchObject({ code: 'invalid' });
    await expect(services.plans.createHangout({ title: 'X', city: 'Riyadh', template: 'Dinner', startsAt: 'not a date' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(services.plans.createHangout({ title: 'X', city: 'Riyadh', template: 'Brunch', startsAt: soon() })).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('invite and join', () => {
  it('an invitee sees the invitation, joins once, and the organizer sees them in', async () => {
    await as('ahmad');
    const { id } = await services.plans.createHangout({ title: 'Brunch', city: 'Riyadh', template: 'Dinner', startsAt: soon(), invitees: ['p-khaled'] });
    await as('nisreen');
    await expect(services.plans.get(id)).rejects.toMatchObject({ code: 'not_found' }); // not invited
    await expect(services.hangouts.respond(id, 'in')).rejects.toMatchObject({ code: 'not_found' });
    await as('khaled');
    expect((await services.plans.listUpcoming()).map((p) => p.id)).toContain(id);
    await expect(services.hangouts.vote(id, 'x', 'up')).rejects.toMatchObject({ code: 'not_found' }); // not a member yet
    await services.hangouts.respond(id, 'in');
    await services.hangouts.respond(id, 'in'); // repeat is harmless
    await as('ahmad');
    const h = await hangout(id);
    expect(h.members.filter((m) => m.personId === 'p-khaled')).toHaveLength(1);
    expect(confirmedIds(h)).toEqual(['p-ahmad', 'p-khaled']);
  });

  it('maybe joins without confirming; declining leaves and drops votes', async () => {
    await as('ahmad');
    const { id } = await services.plans.createHangout({ title: 'Brunch', city: 'Riyadh', template: 'Dinner', startsAt: soon(), invitees: ['p-omar'] });
    await services.hangouts.suggestPlace(id, 'myazu', 'Dinner');
    await as('omar');
    await services.hangouts.respond(id, 'maybe');
    const sg = (await hangout(id)).suggestions[0]!;
    await services.hangouts.vote(id, sg.id, 'up');
    expect(peopleCounts(await hangout(id))).toEqual({ invited: 2, confirmed: 1 });
    await services.hangouts.respond(id, 'declined');
    await expect(services.plans.get(id)).rejects.toMatchObject({ code: 'not_found' });
    await as('ahmad');
    const h = await hangout(id);
    expect(h.members.map((m) => m.personId)).toEqual(['p-ahmad']);
    expect(h.suggestions[0]!.votes).toEqual({});
  });

  it('only the organizer invites, and re-inviting is a no-op', async () => {
    await as('khaled');
    await expect(services.hangouts.invite('plan-friday', ['p-nisreen'])).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    await services.hangouts.invite('plan-friday', ['p-nisreen', 'p-khaled']);
    const h = await hangout('plan-friday');
    expect((h.invites ?? []).filter((i) => i.personId === 'p-khaled')).toHaveLength(1);
    expect((h.invites ?? []).find((i) => i.personId === 'p-nisreen')!.status).toBe('pending');
  });
});

describe('suggest and vote', () => {
  it('rejects duplicate suggestions and unknown slots; Explore lands in the matching slot', async () => {
    await as('khaled');
    await expect(services.hangouts.suggestPlace('plan-friday', 'myazu', 'Dinner')).rejects.toMatchObject({ code: 'duplicate' });
    await expect(services.hangouts.suggestPlace('plan-friday', 'hallab', 'Brunch')).rejects.toMatchObject({ code: 'invalid' });
    await services.plans.addPlace('plan-friday', 'hallab'); // Explore → Add to Plan
    const sg = (await hangout('plan-friday')).suggestions.find((x) => x.placeId === 'hallab')!;
    expect(sg).toMatchObject({ slot: 'Dessert', suggestedBy: 'p-khaled' });
  });

  it('votes toggle, count per person, and show up for everyone', async () => {
    await as('khaled');
    await services.hangouts.vote('plan-friday', 'sg-3', 'up');
    await services.hangouts.vote('plan-friday', 'sg-3', 'up'); // no double vote
    expect(slotSummary(await hangout('plan-friday'), 'Activity')).toMatchObject({ voted: 3, of: 4, state: 'voting' });
    await services.hangouts.vote('plan-friday', 'sg-3', null);
    expect(slotSummary(await hangout('plan-friday'), 'Activity').voted).toBe(2);
    await services.hangouts.voteForPlace('plan-friday', 'Dessert', 'hallab');
    await as('ahmad');
    const dessert = slotSummary(await hangout('plan-friday'), 'Dessert');
    expect(dessert.suggestions[0]).toMatchObject({ placeId: 'hallab', suggestedBy: 'voya', votes: { 'p-khaled': 'up' } });
  });
});

describe('finalize and change', () => {
  it('only the organizer finalizes, only once every slot has a voted place', async () => {
    await as('ahmad');
    expect(canFinalize(await hangout('plan-friday'))).toBe(false); // Dessert has nothing
    await expect(services.hangouts.finalize('plan-friday')).rejects.toMatchObject({ code: 'incomplete' });
    await services.hangouts.voteForPlace('plan-friday', 'Dessert', 'hallab');
    await as('khaled');
    await expect(services.hangouts.finalize('plan-friday')).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    const h = await services.hangouts.finalize('plan-friday');
    expect(h.timeline.map((t) => [t.title, t.subtitle])).toEqual([['Dinner', 'Myazu'], ['Activity', 'The Padel Hub'], ['Dessert', 'Hallab']]);
    expect(Date.parse(h.timeline[1]!.startsAt) - Date.parse(h.timeline[0]!.startsAt)).toBe(120 * 60000);
    await expect(services.hangouts.finalize('plan-friday')).rejects.toMatchObject({ code: 'finalized' });
    await expect(services.hangouts.vote('plan-friday', 'sg-1', null)).rejects.toMatchObject({ code: 'finalized' });
    await as('khaled');
    expect((await hangout('plan-friday')).finalized).toBe(true);
  });

  it('a member suggests a change without altering the final plan', async () => {
    await as('ahmad');
    await services.hangouts.voteForPlace('plan-friday', 'Dessert', 'hallab');
    await services.hangouts.finalize('plan-friday');
    await as('omar');
    await expect(services.hangouts.proposeChange('plan-friday', { slot: 'Dinner' })).rejects.toMatchObject({ code: 'invalid' });
    await services.hangouts.proposeChange('plan-friday', { slot: 'Dinner', placeId: 'roka', note: 'Closer to everyone?' });
    const h = await hangout('plan-friday');
    expect(h.changeRequests).toEqual([expect.objectContaining({ slot: 'Dinner', placeId: 'roka', by: 'p-omar' })]);
    expect(h.timeline[0]!.subtitle).toBe('Myazu');
  });
});

describe('manage', () => {
  it('organizer edits; template change keeps matching suggestions; participants cannot edit', async () => {
    await as('khaled');
    await expect(services.hangouts.update('plan-friday', { title: 'Mine' })).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    const h = await services.hangouts.update('plan-friday', { title: 'Friday Night Out', template: 'Activity + Dinner' });
    expect(h.title).toBe('Friday Night Out');
    expect(slotsFor(h.template)).toEqual(['Activity', 'Dinner']);
    expect(h.suggestions.map((s) => s.slot).sort()).toEqual(['Activity', 'Dinner', 'Dinner']);
  });

  it('removing a person keeps the plan; deleting is organizer-only and removes it for all', async () => {
    await as('ahmad');
    await services.hangouts.removePerson('plan-friday', 'p-faisal');
    expect((await hangout('plan-friday')).members.map((m) => m.personId)).not.toContain('p-faisal');
    await as('khaled');
    await expect(services.hangouts.remove('plan-friday')).rejects.toMatchObject({ code: 'forbidden' });
    await as('ahmad');
    await services.hangouts.remove('plan-friday');
    await as('khaled');
    await expect(services.plans.get('plan-friday')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('the full journey across accounts', () => {
  it('create → invite → join → suggest → vote → finalize → see timeline → suggest change, surviving a restart', async () => {
    await as('ahmad');
    const { id } = await services.plans.createHangout({ title: 'Saturday', city: 'Riyadh', template: 'Dinner + Dessert', startsAt: soon(), invitees: ['p-khaled', 'p-omar'] });
    await services.hangouts.suggestPlace(id, 'myazu', 'Dinner');
    await as('khaled');
    await services.hangouts.respond(id, 'in');
    await services.hangouts.suggestPlace(id, 'hallab', 'Dessert');
    await as('omar');
    await services.hangouts.respond(id, 'in');
    const h1 = await hangout(id);
    for (const sg of h1.suggestions) await services.hangouts.vote(id, sg.id, 'up');
    await as('ahmad');
    const seen = await hangout(id);
    expect(seen.suggestions.every((sg) => sg.votes['p-omar'] === 'up')).toBe(true);
    await services.hangouts.finalize(id);
    await services.auth.signOut();
    const after = restart();
    await after.auth.signIn('khaled@example.com', 'x');
    const final = (await after.plans.get(id)) as Hangout;
    expect(final.finalized).toBe(true);
    expect(final.timeline.map((t) => t.subtitle)).toEqual(['Myazu', 'Hallab']);
    await after.hangouts.proposeChange(id, { slot: 'Dessert', note: 'Somewhere closer?' });
    expect(((await after.plans.get(id)) as Hangout).changeRequests).toHaveLength(1);
  });
});
