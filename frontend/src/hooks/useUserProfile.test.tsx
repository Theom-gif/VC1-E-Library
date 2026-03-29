import {renderHook, act} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('../service/profileService', () => ({
  default: {
    me: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

vi.mock('../utils/readerUpgrade', () => ({
  requestAuth: vi.fn(),
}));

const {useUserProfile} = await import('./useUserProfile');
const profileService = (await import('../service/profileService')).default;
const {requestAuth} = await import('../utils/readerUpgrade');

const mockedProfileService = profileService as unknown as {
  me: ReturnType<typeof vi.fn>;
  updateProfile: ReturnType<typeof vi.fn>;
  uploadAvatar: ReturnType<typeof vi.fn>;
};

const mockedRequestAuth = requestAuth as unknown as ReturnType<typeof vi.fn>;

describe('useUserProfile', () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      const memoryStore = new Map<string, string>();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
          setItem: (key: string, value: string) => {
            memoryStore.set(key, String(value));
          },
          removeItem: (key: string) => {
            memoryStore.delete(key);
          },
          clear: () => {
            memoryStore.clear();
          },
        },
      });
    }

    vi.clearAllMocks();
    globalThis.localStorage.clear();
  });

  it('maps 401 upload errors to session-expired and triggers reauth when token is missing', async () => {
    mockedProfileService.uploadAvatar.mockRejectedValueOnce({
      status: 401,
      message: 'Unauthenticated.',
      data: {message: 'Unauthenticated.'},
    });

    const {result} = renderHook(() => useUserProfile());
    const file = new File(['x'], 'a.jpg', {type: 'image/jpeg'});
    let thrown: any;

    await act(async () => {
      try {
        await result.current.uploadAvatar(file);
      } catch (error) {
        thrown = error;
      }
    });

    expect(mockedRequestAuth).toHaveBeenCalledWith('feature');
    expect(thrown?.status).toBe(401);
    expect(thrown?.message).toBe('Session expired. Please login again.');
    expect(thrown?.data?.message).toBe('Session expired. Please login again.');
    expect(result.current.error?.data?.message).toBe('Session expired. Please login again.');
  });

  it('keeps token and does not force reauth for 401 when token exists', async () => {
    mockedProfileService.uploadAvatar.mockRejectedValueOnce({
      status: 401,
      message: 'Unauthenticated.',
      data: {message: 'Unauthenticated.'},
    });
    localStorage.setItem('token', 'still-valid-token');

    const {result} = renderHook(() => useUserProfile());
    const file = new File(['x'], 'a.jpg', {type: 'image/jpeg'});
    let thrown: any;

    await act(async () => {
      try {
        await result.current.uploadAvatar(file);
      } catch (error) {
        thrown = error;
      }
    });

    expect(mockedRequestAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBe('still-valid-token');
    expect(thrown?.status).toBe(401);
    expect(thrown?.message).toBe('Unauthenticated.');
  });

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
