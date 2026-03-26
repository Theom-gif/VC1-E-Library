import React from 'react';
import {useI18n} from '../../i18n/I18nProvider';
import {useToast} from '../ToastProvider';
import {resizeImageFileToDataUrl} from '../../utils/image';
import {validateAvatarFile} from '../../utils/profileValidators';

type Props = {
  nameForAlt: string;
  value: string;
  disabled?: boolean;
  onUploaded: (file: File) => Promise<void>;
};

export default function AvatarUploader({nameForAlt, value, disabled, onUploaded}: Props) {
  const {t} = useI18n();
  const toast = useToast();
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setPreview(value);
  }, [value]);

  const handleFile = React.useCallback(
    async (file: File) => {
      const validation = validateAvatarFile(file);
      if (validation === 'invalid_type') {
        setError(t('profile.invalidImageType'));
        return;
      }
      if (validation === 'too_large') {
        setError(t('profile.imageTooLarge'));
        return;
      }
      setError('');

      try {
        const dataUrl = await resizeImageFileToDataUrl(file, {maxWidth: 512, maxHeight: 512, mimeType: 'image/jpeg', quality: 0.86});
        setPreview(dataUrl);
      } catch {
        // Non-blocking: upload can still proceed even if local preview fails.
      }

      try {
        await onUploaded(file);
        toast.push({kind: 'success', message: t('profile.avatarUpdated')});
      } catch (e: any) {
        setError(e?.data?.message || e?.message || 'Upload failed.');
        toast.push({kind: 'error', message: e?.data?.message || e?.message || 'Upload failed.'});
      }
    },
    [onUploaded, t, toast],
  );

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleFile(file);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <img
          src={preview}
          alt={t('profile.avatarAlt', {name: nameForAlt || 'User'})}
          className="size-20 rounded-2xl object-cover border border-border bg-surface"
        />
        <div className="flex-1">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPick} />
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              if (!disabled) setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDrop}
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isDragging ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface'
            } ${disabled ? 'opacity-60' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 font-bold text-text hover:bg-white/10 disabled:cursor-not-allowed"
              >
                {t('common.chooseFile')}
              </button>
              <span className="text-text-muted text-xs font-semibold">{t('common.or')}</span>
              <span className="text-text text-xs font-semibold">{t('profile.dragDrop')}</span>
              <span className="text-text-muted text-xs">{t('profile.avatarHint')}</span>
            </div>
          </div>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

