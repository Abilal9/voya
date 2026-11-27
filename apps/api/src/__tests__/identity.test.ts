import { nameFromEmail } from '../users/identity.service';

describe('nameFromEmail', () => {
  it('derives a readable first name', () => {
    expect(nameFromEmail('ahmad.bilal@example.com')).toBe('Ahmad bilal');
    expect(nameFromEmail('omar@example.com')).toBe('Omar');
  });
  it('falls back when there is no email', () => {
    expect(nameFromEmail(undefined)).toBe('Voya member');
    expect(nameFromEmail('@x.com')).toBe('Voya member');
  });
});
