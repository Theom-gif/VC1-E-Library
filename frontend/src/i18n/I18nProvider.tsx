import React from 'react';

type I18nMessages = Record<string, string>;

type I18nContextValue = {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

const EN_MESSAGES: I18nMessages = {
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.saving': 'Saving...',
  'common.chooseFile': 'Choose file',
  'common.or': 'or',
  'common.loading': 'Loading...',
  'common.required': '{field} is required.',
  'common.unsavedChanges': 'You have unsaved changes. Are you sure you want to leave?',

  'profile.edit': 'Edit Profile',
  'profile.saveChanges': 'Save Changes',
  'profile.logout': 'Log Out',
  'profile.share': 'Share profile',
  'profile.fullName': 'Full name',
  'profile.firstName': 'First name',
  'profile.lastName': 'Last name',
  'profile.bio': 'Bio',
  'profile.facebookUrl': 'Facebook URL',
  'profile.avatar': 'Avatar',
  'profile.avatarAlt': '{name} avatar',
  'profile.avatarHint': 'PNG or JPEG up to 5MB.',
  'profile.dropHere': 'Drop an image here',
  'profile.dragDrop': 'Drag & drop',
  'profile.uploading': 'Uploading...',
  'profile.updated': 'Profile updated.',
  'profile.avatarUpdated': 'Avatar updated.',
  'profile.invalidImageType': 'Only PNG or JPEG images are allowed.',
  'profile.imageTooLarge': 'Image must be 5MB or smaller.',
  'profile.nameTooLong': 'Name must be {max} characters or fewer.',
  'profile.bioTooLong': 'Bio must be {max} characters or fewer.',
  'profile.invalidUrl': 'Please enter a valid URL.',
  'profile.range7d': 'Last 7 Days',
  'profile.range30d': 'Last 30 Days',
  'profile.range1y': 'This Year',
  'profile.readingActivity': 'Reading Activity',
  'profile.currentlyReading': 'Currently Reading',
  'profile.achievements': 'Achievements',
  'profile.friends': 'Friends',
  'profile.seeAll': 'See All',
  'profile.noFollowing': 'No following yet',
  'profile.noFollowingHint': 'Follow an author from a book page or the authors directory.',
  'profile.browseAuthors': 'Browse Authors',
  'profile.followersCount': '{count} followers',
  'profile.booksRead': 'Books Read',
  'profile.readingStreak': 'Reading Streak',
  'profile.followers': 'Followers',
  'profile.following': 'Following',
  'profile.tagline': 'Passionate reader',
  'profile.taglineMemberSince': 'Passionate reader \u2022 Member since {date}',
  'profile.loadingBackendActivity': 'Loading backend activity...',
  'profile.loadingBackendBooks': 'Loading backend books...',

  'nav.searchPlaceholder': 'Search books, authors, categories...',
  'nav.clearSearch': 'Clear search',
  'search.noResultsFor': 'No results for "{query}"',
  'search.viewAll': 'View all results',
};

export function I18nProvider({
  children,
  locale = 'en',
  messages,
}: {
  children: React.ReactNode;
  locale?: string;
  messages?: Partial<I18nMessages>;
}) {
  const merged = React.useMemo(() => ({...EN_MESSAGES, ...(messages || {})}), [messages]);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = merged[key] ?? key;
      return interpolate(raw, vars);
    },
    [merged],
  );

  const value = React.useMemo<I18nContextValue>(() => ({locale, t}), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    return {locale: 'en', t: (key: string, vars?: Record<string, string | number>) => interpolate(key, vars)};
  }
  return ctx;
}
