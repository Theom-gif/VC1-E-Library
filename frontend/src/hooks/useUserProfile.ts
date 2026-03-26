import React from 'react';
import profileService, {type ProfileSummary} from '../service/profileService';

export type UpdateProfileInput = {
  firstname: string;
  lastname?: string;
  bio?: string;
  facebookUrl?: string;
};

export function useUserProfile() {
  const [profile, setProfile] = React.useState<ProfileSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [error, setError] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await profileService.me();
      setProfile(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = React.useCallback(
    async (input: UpdateProfileInput) => {
      setSaving(true);
      setError(null);
      const optimisticName = `${String(input.firstname || '').trim()} ${String(input.lastname || '').trim()}`.trim();
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
        setError(err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const uploadAvatar = React.useCallback(async (file: File) => {
    setUploadingAvatar(true);
    setError(null);
    try {
      const saved = await profileService.uploadAvatar(file);
      setProfile((prev) => (prev ? {...prev, photo: saved.photo || prev.photo} : saved));
      return saved.photo;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

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

