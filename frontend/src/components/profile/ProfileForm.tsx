import React from 'react';
import {useI18n} from '../../i18n/I18nProvider';
import {useToast} from '../ToastProvider';
import {useUnsavedChanges} from '../../context/UnsavedChangesContext';
import {useUserProfile} from '../../hooks/useUserProfile';
import {MAX_BIO_LENGTH, MAX_NAME_LENGTH, validateBio, validateHttpUrl, validateRequiredText} from '../../utils/profileValidators';
import AvatarUploader from './AvatarUploader';

type Props = {
  initialName: string;
  initialPhoto: string;
  onClose: () => void;
  onUpdatedUser: (next: {name: string; photo: string; memberSince?: string; membership?: string}) => void;
};

function splitFullName(value: string): {firstname: string; lastname: string} {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return {firstname: '', lastname: ''};
  if (parts.length === 1) return {firstname: parts[0], lastname: ''};

  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(' '),
  };
}

export default function ProfileForm({initialName, initialPhoto, onClose, onUpdatedUser}: Props) {
  const {t} = useI18n();
  const toast = useToast();
  const {setDirty} = useUnsavedChanges();
  const {profile, loading, saving, uploadingAvatar, load, update, uploadAvatar, setProfile} = useUserProfile();

  const [fullName, setFullName] = React.useState(initialName);
  const [bio, setBio] = React.useState('');
  const [facebookUrl, setFacebookUrl] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const disabled = loading || saving || uploadingAvatar;

  React.useEffect(() => {
    let alive = true;
    void load()
      .then((p) => {
        if (!alive) return;
        setFullName(p.name || initialName);
        setBio(p.bio || '');
        setFacebookUrl(p.facebookUrl || '');
      })
      .catch(() => {
        // keep initial fallback
      });
    return () => {
      alive = false;
    };
  }, [initialName, load]);

  React.useEffect(() => {
    const initial = profile?.name || initialName;
    const dirty =
      fullName.trim() !== String(initial).trim() ||
      bio.trim() !== String(profile?.bio || '').trim() ||
      facebookUrl.trim() !== String(profile?.facebookUrl || '').trim();
    setDirty(dirty);
  }, [bio, facebookUrl, fullName, initialName, profile?.bio, profile?.facebookUrl, profile?.name, setDirty]);

  const validate = () => {
    const errors: Record<string, string> = {};
    const nameResult = validateRequiredText(fullName, MAX_NAME_LENGTH);
    if (nameResult === 'required') errors.fullName = t('common.required', {field: t('profile.fullName')});
    if (nameResult === 'too_long') errors.fullName = t('profile.nameTooLong', {max: MAX_NAME_LENGTH});

    const bioResult = validateBio(bio);
    if (bioResult === 'too_long') errors.bio = t('profile.bioTooLong', {max: MAX_BIO_LENGTH});

    const urlResult = validateHttpUrl(facebookUrl);
    if (urlResult === 'invalid') errors.facebookUrl = t('profile.invalidUrl');

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    const {firstname, lastname} = splitFullName(fullName);
    try {
      const saved = await update({firstname, lastname, bio, facebookUrl});
      toast.push({kind: 'success', message: t('profile.updated')});
      setDirty(false);
      onUpdatedUser({
        name: saved.name || fullName.trim(),
        photo: saved.photo || profile?.photo || initialPhoto,
        membership: saved.membership,
        memberSince: saved.memberSince,
      });
      onClose();
    } catch (e: any) {
      toast.push({kind: 'error', message: e?.data?.message || e?.message || 'Save failed.'});
    }
  };

  const onAvatarUploaded = async (file: File) => {
    const nextPhoto = await uploadAvatar(file);
    if (nextPhoto) {
      setProfile((prev) => (prev ? {...prev, photo: nextPhoto} : prev));
      onUpdatedUser({
        name: profile?.name || fullName.trim() || initialName,
        photo: nextPhoto,
        membership: profile?.membership,
        memberSince: profile?.memberSince,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="profile-fullname" className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {t('profile.fullName')}
          </label>
          <input
            id="profile-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={disabled}
            className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-text focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
            maxLength={MAX_NAME_LENGTH}
          />
          {fieldErrors.fullName ? <p className="text-xs text-red-300">{fieldErrors.fullName}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="profile-facebook" className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            {t('profile.facebookUrl')}
          </label>
          <input
            id="profile-facebook"
            type="url"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            disabled={disabled}
            className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-text focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
            placeholder="https://facebook.com/..."
          />
          {fieldErrors.facebookUrl ? <p className="text-xs text-red-300">{fieldErrors.facebookUrl}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="profile-bio" className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
          {t('profile.bio')}
        </label>
        <textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={disabled}
          className="min-h-24 w-full bg-surface border border-border rounded-xl px-4 py-2 text-text focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
          maxLength={MAX_BIO_LENGTH}
        />
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>{fieldErrors.bio ? <span className="text-red-300">{fieldErrors.bio}</span> : null}</span>
          <span>
            {bio.length}/{MAX_BIO_LENGTH}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('profile.avatar')}</div>
        <AvatarUploader
          nameForAlt={fullName.trim() || initialName}
          value={profile?.photo || initialPhoto}
          disabled={disabled}
          onUploaded={onAvatarUploaded}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setDirty(false);
            onClose();
          }}
          disabled={disabled}
          className="px-6 py-2 rounded-xl font-bold text-text-muted hover:text-text transition-all disabled:opacity-60"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={disabled}
          className="bg-primary text-white px-8 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
        >
          {saving ? t('common.saving') : t('profile.saveChanges')}
        </button>
      </div>
    </div>
  );
}

