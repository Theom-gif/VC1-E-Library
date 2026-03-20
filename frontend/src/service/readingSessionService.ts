import apiClient from './apiClient';

export type ReadingSessionSource = 'web' | 'offline';

export type StartReadingSessionPayload = {
  book_id: string;
  started_at: string;
  source: ReadingSessionSource;
};

export type ReadingSessionHeartbeatPayload = {
  occurred_at: string;
  seconds_since_last_ping: number;
  progress_percent?: number;
};

export type FinishReadingSessionPayload = {
  ended_at: string;
  progress_percent?: number;
};

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function normalizeSessionId(payload: any): string {
  return pickString(
    payload?.data?.session_id,
    payload?.data?.id,
    payload?.session_id,
    payload?.id,
  );
}

async function postWithAliasFallback<T>(paths: string[], body: unknown): Promise<T> {
  let lastError: any;
  for (const path of paths) {
    try {
      return await apiClient.post(path, body) as T;
    } catch (error: any) {
      if (Number(error?.status) !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Reading session endpoint not found.');
}

export const readingSessionService = {
  start: async (payload: StartReadingSessionPayload): Promise<{sessionId: string}> => {
    const response = await postWithAliasFallback(
      [
        '/api/reading-sessions/start',
        '/api/reading-session/start',
        '/api/reading/start',
      ],
      payload,
    );
    const sessionId = normalizeSessionId(response);
    if (!sessionId) {
      throw new Error('Backend did not return a reading session id.');
    }
    return {sessionId};
  },

  heartbeat: async (sessionId: string, payload: ReadingSessionHeartbeatPayload) =>
    postWithAliasFallback(
      [
        `/api/reading-sessions/${encodeURIComponent(sessionId)}/heartbeat`,
        `/api/reading-session/${encodeURIComponent(sessionId)}/heartbeat`,
        `/api/reading/${encodeURIComponent(sessionId)}/heartbeat`,
      ],
      payload,
    ),

  finish: async (sessionId: string, payload: FinishReadingSessionPayload) =>
    postWithAliasFallback(
      [
        `/api/reading-sessions/${encodeURIComponent(sessionId)}/finish`,
        `/api/reading-session/${encodeURIComponent(sessionId)}/finish`,
        `/api/reading/${encodeURIComponent(sessionId)}/finish`,
      ],
      payload,
    ),
};

export default readingSessionService;
