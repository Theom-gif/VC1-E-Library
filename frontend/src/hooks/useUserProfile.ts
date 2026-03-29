import React from 'react';
import profileService, {type ProfileSummary} from '../service/profileService';
import {requestAuth} from '../utils/readerUpgrade';
import authService from '../service/authService';

export type UpdateProfileInput = {
  firstname: string;
  lastname?: string;
  bio?: string;
  facebookUrl?: string;
};

export function useUserProfile() {
  const [profile, setProfile] = React.useState<ProfileSummary | null>(null);
  const profileRef = React.useRef<ProfileSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const mapRequestError = React.useCallback((err: any) => {
    const status = Number(err?.status);
    if (status !== 401) return err;

    const hasToken = Boolean(authService.getToken());
    if (hasToken) return err;

    requestAuth('feature');

    const message = 'Session expired. Please login again.';
    return {
      ...err,
      message,
      data: {
        ...(err?.data && typeof err.data === 'object' ? err.data : {}),
        message,
      },
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await profileService.me();
      setProfile(next);
      return next;
    } catch (err: any) {
      const mapped = mapRequestError(err);
      setError(mapped);
      throw mapped;
    } finally {
      setLoading(false);
    }
  }, [mapRequestError]);

  const update = React.useCallback(
    async (input: UpdateProfileInput) => {
      setSaving(true);
      setError(null);
      const optimisticName = `${String(input.firstname || '').trim()} ${String(input.lastname || '').trim()}`.trim();
      const previous = profileRef.current;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              firstname: input.firstname,
              lastname: input.lastname || undefined,
              name: optimisticName || prev.name,
              bio: input.bio || undefined,
              facebookUrl: input.facebookUrl || undefined,
            }
          : prev,
      );
      try {
        const saved = await profileService.updateProfile({
          firstname: input.firstname,
          lastname: input.lastname,
          bio: input.bio,
          facebook_url: input.facebookUrl,
          name: optimisticName || undefined,
        } as any);
        setProfile(saved);
        return saved;
      } catch (err) {
        const mapped = mapRequestError(err);
        setProfile(previous);
        setError(mapped);
        throw mapped;
      } finally {
        setSaving(false);
      }
    },
    [mapRequestError],
  );

  const uploadAvatar = React.useCallback(async (file: File) => {
    setUploadingAvatar(true);
    setError(null);
    try {
      const saved = await profileService.uploadAvatar(file);
      setProfile((prev) => (prev ? {...prev, photo: saved.photo || prev.photo} : saved));
      return saved.photo;
    } catch (err) {
      const mapped = mapRequestError(err);
      setError(mapped);
      throw mapped;
    } finally {
      setUploadingAvatar(false);
    }
  }, [mapRequestError]);

  return {
    profile,
    loading,
    saving,
    uploadingAvatar,
    error,
    load,
    update,
    uploadAvatar,
    setProfile,
  };
}
