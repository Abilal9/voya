import { initialNames, nameFromEmail } from '../users/identity.service';
import { nextStep } from '../users/profile.service';
import { sniffImage } from '../users/avatar.service';

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

describe('initialNames', () => {
  it('prefers the names given at sign-up', () => {
    expect(initialNames({ email: 'x@y.z', signUpNames: { firstName: 'Sara', lastName: 'Ali' } })).toEqual({
      firstName: 'Sara', lastName: 'Ali', displayName: 'Sara Ali',
    });
  });
  it('uses the email when sign-up gave no first name', () => {
    expect(initialNames({ email: 'omar@example.com' })).toEqual({ firstName: 'Omar', lastName: null, displayName: 'Omar' });
  });
});

describe('nextStep', () => {
  it('advances past the completed step and never goes back', () => {
    expect(nextStep('profile', 'profile')).toBe('interests');
    expect(nextStep('location', 'interests')).toBe('location');
    expect(nextStep('notifications', 'notifications')).toBe('done');
    expect(nextStep('done', 'profile')).toBe('done');
  });
});

describe('sniffImage', () => {
  const bytes = (...b: number[]) => Uint8Array.from([...b, ...Array(16).fill(0)]);
  const text = (s: string) => Uint8Array.from([...Buffer.from(s), ...Array(16).fill(0)]);
  it('recognises the accepted formats by their magic bytes', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffImage(text('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(text('\0\0\0\x18ftypheic'))).toBe('image/heic');
  });
  it('rejects anything else', () => {
    expect(sniffImage(text('<svg xmlns='))).toBeUndefined();
    expect(sniffImage(text('GIF89a'))).toBeUndefined();
    expect(sniffImage(new Uint8Array())).toBeUndefined();
  });
});
