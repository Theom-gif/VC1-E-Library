import {describe, expect, it} from 'vitest';
import {
  MAX_AVATAR_BYTES,
  MAX_BIO_LENGTH,
  MAX_NAME_LENGTH,
  validateAvatarFile,
  validateBio,
  validateHttpUrl,
  validateRequiredText,
} from './profileValidators';

describe('profileValidators', () => {
  it('validateRequiredText: required + too_long', () => {
    expect(validateRequiredText('')).toBe('required');
    expect(validateRequiredText('   ')).toBe('required');
    expect(validateRequiredText('ok', MAX_NAME_LENGTH)).toBe('');
    expect(validateRequiredText('x'.repeat(MAX_NAME_LENGTH + 1), MAX_NAME_LENGTH)).toBe('too_long');
  });

  it('validateBio: max length', () => {
    expect(validateBio('')).toBe('');
    expect(validateBio('x'.repeat(MAX_BIO_LENGTH))).toBe('');
    expect(validateBio('x'.repeat(MAX_BIO_LENGTH + 1))).toBe('too_long');
  });

  it('validateHttpUrl: optional + http/https only', () => {
    expect(validateHttpUrl('')).toBe('');
    expect(validateHttpUrl('https://example.com')).toBe('');
    expect(validateHttpUrl('http://example.com/path')).toBe('');
    expect(validateHttpUrl('ftp://example.com')).toBe('invalid');
    expect(validateHttpUrl('not a url')).toBe('invalid');
  });

  it('validateAvatarFile: png/jpeg only + <= 5MB', () => {
    const jpeg = new File(['x'], 'a.jpg', {type: 'image/jpeg'});
    Object.defineProperty(jpeg, 'size', {value: MAX_AVATAR_BYTES});
    expect(validateAvatarFile(jpeg)).toBe('');

    const big = new File(['x'], 'b.jpg', {type: 'image/jpeg'});
    Object.defineProperty(big, 'size', {value: MAX_AVATAR_BYTES + 1});
    expect(validateAvatarFile(big)).toBe('too_large');

    const badType = new File(['x'], 'c.gif', {type: 'image/gif'});
    Object.defineProperty(badType, 'size', {value: 10});
    expect(validateAvatarFile(badType)).toBe('invalid_type');
  });
});

