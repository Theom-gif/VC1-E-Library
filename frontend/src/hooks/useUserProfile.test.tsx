import {renderHook, act} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

vi.mock('../service/profileService', () => ({
  default: {
    me: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

const {useUserProfile} = await import('./useUserProfile');
const profileService = (await import('../service/profileService')).default;

const mockedProfileService = profileService as unknown as {
  me: ReturnType<typeof vi.fn>;
  updateProfile: ReturnType<typeof vi.fn>;
  uploadAvatar: ReturnType<typeof vi.fn>;
};

describe('useUserProfile', () => {
  it('load() populates profile', async () => {
    mockedProfileService.me.mockResolvedValueOnce({name: 'Jane Doe', photo: '/a.jpg'});
    const {result} = renderHook(() => useUserProfile());

    await act(async () => {
      await result.current.load();
    });

    expect(mockedProfileService.me).toHaveBeenCalledTimes(1);
    expect(result.current.profile?.name).toBe('Jane Doe');
  });

  it('update() calls updateProfile and updates profile', async () => {
    mockedProfileService.updateProfile.mockResolvedValueOnce({name: 'Jane Doe', photo: '/a.jpg', bio: 'hi'});
    const {result} = renderHook(() => useUserProfile());

    await act(async () => {
      await result.current.update({firstname: 'Jane', lastname: 'Doe', bio: 'hi', facebookUrl: 'https://fb.com/jane'});
    });

    expect(mockedProfileService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstname: 'Jane',
        lastname: 'Doe',
        bio: 'hi',
        facebook_url: 'https://fb.com/jane',
        name: 'Jane Doe',
      }),
    );
    expect(result.current.profile?.bio).toBe('hi');
  });

  it('uploadAvatar() calls uploadAvatar and updates photo', async () => {
    mockedProfileService.uploadAvatar.mockResolvedValueOnce({name: 'Jane Doe', photo: '/new.jpg'});
    const {result} = renderHook(() => useUserProfile());

    const file = new File(['x'], 'a.jpg', {type: 'image/jpeg'});
    await act(async () => {
      await result.current.uploadAvatar(file);
    });

    expect(mockedProfileService.uploadAvatar).toHaveBeenCalledWith(file);
    expect(result.current.profile?.photo).toBe('/new.jpg');
  });
});
