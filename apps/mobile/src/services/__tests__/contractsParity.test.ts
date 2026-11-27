import { HANGOUT_TEMPLATE_SLOTS } from '@voya/contracts';
import { HANGOUT_TEMPLATES } from '../hangoutRules';

/** The API validates hangout templates against the shared contracts; they must be the app's own. */
it('shares the hangout templates with the API contracts', () => {
  expect(HANGOUT_TEMPLATE_SLOTS).toEqual(HANGOUT_TEMPLATES);
});
