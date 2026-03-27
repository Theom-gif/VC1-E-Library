import apiClient from './apiClient';

export type AchievementKey = 'streak' | 'elite' | 'fast' | 'scholar' | 'critic';

export type AchievementDefinition = {
  key: AchievementKey;
  label: string;
  description?: string;
  threshold?: number;
  unit?: string;
};

export type UserAchievement = AchievementDefinition & {
  unlocked: boolean;
  progress?: number;
  unlocked_at?: string | null;
};

export type ReadingLogPayload = {
  book_id?: string | number;
  total_seconds?: number;
  minutes?: number;
  logged_at?: string;
  user_id?: string | number;
};

function pickString(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : '';
}

function normalizeKey(value: unknown): AchievementKey | '' {
  const raw = pickString(value).toLowerCase();
  if (raw === 'streak') return 'streak';
  if (raw === 'elite') return 'elite';
  if (raw === 'fast' || raw === 'speed') return 'fast';
  if (raw === 'scholar') return 'scholar';
  if (raw === 'critic' || raw === 'review') return 'critic';
  return '';
}

function normalizeDefinition(raw: any, fallbackKey?: AchievementKey): AchievementDefinition | null {
  const key = normalizeKey(raw?.key ?? raw?.code ?? raw?.name) || fallbackKey || '';
  if (!key) return null;
  return {
    key,
    label: pickString(raw?.label, raw?.title, raw?.name, key),
    description: pickString(raw?.description, raw?.text) || undefined,
    threshold: raw?.threshold !== undefined ? Number(raw.threshold) : undefined,
    unit: pickString(raw?.unit) || undefined,
  };
}

function normalizeUserAchievement(raw: any): UserAchievement | null {
  const def = normalizeDefinition(raw);
  if (!def) return null;
  const unlockedRaw = raw?.unlocked ?? raw?.is_unlocked ?? raw?.earned ?? raw?.achieved;
  const unlocked =
    typeof unlockedRaw === 'boolean'
      ? unlockedRaw
      : typeof unlockedRaw === 'number'
        ? unlockedRaw === 1
        : typeof unlockedRaw === 'string'
          ? ['1', 'true', 'yes', 'earned', 'unlocked'].includes(unlockedRaw.trim().toLowerCase())
          : Boolean(raw?.unlocked_at || raw?.earned_at);

  return {
    ...def,
    unlocked,
    progress: raw?.progress !== undefined ? Number(raw.progress) : undefined,
    unlocked_at: raw?.unlocked_at ?? raw?.earned_at ?? null,
  };
}

function normalizeDefinitionList(payload: any): AchievementDefinition[] {
  const list =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload) && payload) ||
    [];
  const items = list
    .map((item: any) => normalizeDefinition(item))
    .filter(Boolean) as AchievementDefinition[];

  return items;
}

function normalizeUserAchievementList(payload: any): UserAchievement[] {
  const list =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.achievements) && payload.achievements) ||
    (Array.isArray(payload) && payload) ||
    [];
  const items = list
    .map((item: any) => normalizeUserAchievement(item))
    .filter(Boolean) as UserAchievement[];

  return items;
}

async function with404Fallback<T>(paths: string[], fn: (path: string) => Promise<T>): Promise<T> {
  let lastError: any;
  for (const path of paths) {
    try {
      return await fn(path);
    } catch (error: any) {
      if (Number(error?.status) !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Achievement endpoint not found.');
}

export const achievementService = {
  listDefinitions: async (): Promise<AchievementDefinition[]> => {
    const payload = await with404Fallback(['/api/achievements'], (path) =>
      apiClient.get(path, {headers: {Accept: 'application/json'}, auth: false}) as any,
    );
    return normalizeDefinitionList(payload);
  },

  listForUser: async (userId: string | number): Promise<UserAchievement[]> => {
    const id = encodeURIComponent(pickString(userId));
    const payload = await with404Fallback([`/api/users/${id}/achievements`], (path) =>
      apiClient.get(path, {headers: {Accept: 'application/json'}}) as any,
    );
    const items = normalizeUserAchievementList(payload);
    if (items.length) return items;

    // If the backend returns only definitions, still convert to "locked" achievements.
    const defs = normalizeDefinitionList(payload);
    return defs.map((d) => ({...d, unlocked: false}));
  },

  createReadingLog: async (payload?: ReadingLogPayload) => {
    return apiClient.post('/api/reading-logs', payload || {}, {headers: {Accept: 'application/json'}});
  },

  checkForUser: async (userId: string | number) => {
    const id = encodeURIComponent(pickString(userId));
    return apiClient.post(`/api/users/${id}/check-achievements`, undefined, {headers: {Accept: 'application/json'}});
  },
};

export default achievementService;

