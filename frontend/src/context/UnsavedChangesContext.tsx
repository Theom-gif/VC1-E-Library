import React from 'react';
import {useI18n} from '../i18n/I18nProvider';

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmIfDirty: () => boolean;
};

const UnsavedChangesContext = React.createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({children}: {children: React.ReactNode}) {
  const {t} = useI18n();
  const [isDirty, setIsDirty] = React.useState(false);

  const confirmIfDirty = React.useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(t('common.unsavedChanges'));
  }, [isDirty, t]);

  React.useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = t('common.unsavedChanges');
      return event.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, t]);

  const value = React.useMemo<UnsavedChangesContextValue>(
    () => ({
      isDirty,
      setDirty: setIsDirty,
      confirmIfDirty,
    }),
    [confirmIfDirty, isDirty],
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const ctx = React.useContext(UnsavedChangesContext);
  if (!ctx) {
    return {isDirty: false, setDirty: (_dirty: boolean) => {}, confirmIfDirty: () => true};
  }
  return ctx;
}

