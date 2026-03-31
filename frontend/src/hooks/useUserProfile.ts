import React from 'react';
import profileService, {type ProfileSummary} from '../service/profileService';
import {requestAuth} from '../utils/readerUpgrade';
import authService from '../service/authService';
import {resizeImageFileToDataUrl} from '../utils/image';

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
        // Some backends omit `photo` in profile update responses. Preserve the existing photo to avoid
        // "losing" the selected avatar after clicking Save Changes.
        const merged = (previous || profileRef.current)
          ? {
              ...saved,
              photo: saved.photo || (previous || profileRef.current)?.photo || '',
              membership: saved.membership || (previous || profileRef.current)?.membership,
              memberSince: saved.memberSince || (previous || profileRef.current)?.memberSince,
            }
          : saved;
        setProfile(merged);
        return merged;
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
      if (saved.photo) {
        setProfile((prev) => (prev ? {...prev, photo: saved.photo || prev.photo} : saved));
        return saved.photo;
      }

      // Backend didn't return a usable photo URL; store a resized data URL locally as a reliable fallback.
      const localPhoto = await resizeImageFileToDataUrl(file, {
        maxWidth: 512,
        maxHeight: 512,
        mimeType: 'image/jpeg',
        quality: 0.86,
      });
      setProfile((prev) => (prev ? {...prev, photo: localPhoto} : {...saved, photo: localPhoto}));
      return localPhoto;
    } catch (err) {
      const mapped = mapRequestError(err);
      const status = Number((mapped as any)?.status);
      if (status === 401) {
        setError(mapped);
        throw mapped;
      }

      // If upload fails (missing endpoint / offline / dev backend), persist the selected image locally
      // so the user still "stores" their chosen profile picture on this device.
      try {
        const localPhoto = await resizeImageFileToDataUrl(file, {
          maxWidth: 512,
          maxHeight: 512,
          mimeType: 'image/jpeg',
          quality: 0.86,
        });
        setProfile((prev) => (prev ? {...prev, photo: localPhoto} : prev));
        return localPhoto;
      } catch {
        setError(mapped);
        throw mapped;
      }
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
