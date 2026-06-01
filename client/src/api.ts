import type {
  AiModelsResponse,
  AuthStatus,
  AwayPeriod,
  ExtractResponse,
  Medication,
  Person,
  PrnAssignment,
  Routine,
  ScheduledAssignment,
  Settings,
  SettingsPatch,
} from './types';
import type { DayLog, DayPayload, PrnLog, PrnToday } from './grid/types';

export type GroupRow = {
  group_id: number;
  group_name: string;
  taken_on_time: number;
  taken_late: number;
  missed: number;
  away: number;
  pending: number;
  scheduled: number;
  total: number;
};

export type ReportSummary = {
  window: 7 | 30;
  since: string;
  until: string;
  by_person: GroupRow[];
  by_medication: GroupRow[];
  by_routine: GroupRow[];
};

export type ReportDay = {
  date: string;
  scheduled: DayLog[];
  prn: PrnLog[];
};

export type PrnHistoryGroup = {
  person_id: number;
  person_name: string;
  medication_id: number;
  med_proper_name: string;
  med_brand_name: string | null;
  med_dose: string;
  med_dose_size: string | null;
  count: number;
  last_taken_at: string | null;
  logs: {
    id: number;
    date: string;
    taken_at: string;
    dispensed: 0 | 1;
    dispensed_by: string | null;
  }[];
};

export type PrnHistory = {
  since: string;
  until: string;
  days: 7 | 30 | 90;
  groups: PrnHistoryGroup[];
};

const TOKEN_KEY = 'meds.pinToken';

export const auth = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(t: string | null) {
    if (t === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, t);
  },
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = auth.getToken();
  if (token) headers.set('x-pin-token', token);

  const res = await fetch(path, {
    ...init,
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as Record<string, unknown>).message)
        : null) ??
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as Record<string, unknown>).error)
        : null) ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}

export const api = {
  // auth
  authStatus: () => request<AuthStatus>('GET', '/api/auth/status'),
  verifyPin: (pin: string) =>
    request<{ token: string }>('POST', '/api/auth/pin/verify', { pin }),
  setPin: (pin: string) =>
    request<{ token: string }>('POST', '/api/auth/pin/set', { pin }),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout'),

  // settings
  getSettings: () => request<Settings>('GET', '/api/settings'),
  updateSettings: (patch: SettingsPatch) =>
    request<Settings>('PATCH', '/api/settings', patch),

  // webhooks
  testWebhook: () =>
    request<{ ok: boolean; url?: string; error?: string }>('POST', '/api/webhooks/test'),
  schedulerTick: () => request<{ ok: true }>('POST', '/api/webhooks/tick'),

  // reporting
  getSummary: (q: { window: 7 | 30; until?: string }) => {
    const params = new URLSearchParams({ window: String(q.window) });
    if (q.until) params.set('until', q.until);
    return request<ReportSummary>('GET', `/api/reporting/summary?${params}`);
  },
  getReportDay: (date: string) =>
    request<ReportDay>('GET', `/api/reporting/day?date=${date}`),
  getPrnHistory: (days: 7 | 30 | 90) =>
    request<PrnHistory>('GET', `/api/reporting/prn-history?days=${days}`),

  // people
  listPeople: () => request<Person[]>('GET', '/api/people'),
  createPerson: (b: Partial<Person>) => request<Person>('POST', '/api/people', b),
  updatePerson: (id: number, b: Partial<Person>) =>
    request<Person>('PATCH', `/api/people/${id}`, b),
  deletePerson: (id: number) => request<void>('DELETE', `/api/people/${id}`),

  // routines
  listRoutines: () => request<Routine[]>('GET', '/api/routines'),
  createRoutine: (b: Partial<Routine>) => request<Routine>('POST', '/api/routines', b),
  updateRoutine: (id: number, b: Partial<Routine>) =>
    request<Routine>('PATCH', `/api/routines/${id}`, b),
  deleteRoutine: (id: number) => request<void>('DELETE', `/api/routines/${id}`),

  // medications
  listMedications: () => request<Medication[]>('GET', '/api/medications'),
  createMedication: (b: Partial<Medication>) =>
    request<Medication>('POST', '/api/medications', b),
  updateMedication: (id: number, b: Partial<Medication>) =>
    request<Medication>('PATCH', `/api/medications/${id}`, b),
  deleteMedication: (id: number) => request<void>('DELETE', `/api/medications/${id}`),

  // scheduled assignments
  listScheduledAssignments: (q?: { routine_id?: number; person_id?: number }) => {
    const params = new URLSearchParams();
    if (q?.routine_id) params.set('routine_id', String(q.routine_id));
    if (q?.person_id) params.set('person_id', String(q.person_id));
    const qs = params.toString();
    return request<ScheduledAssignment[]>(
      'GET',
      `/api/scheduled-assignments${qs ? '?' + qs : ''}`
    );
  },
  createScheduledAssignment: (b: Partial<ScheduledAssignment>) =>
    request<ScheduledAssignment>('POST', '/api/scheduled-assignments', b),
  updateScheduledAssignment: (id: number, b: Partial<ScheduledAssignment>) =>
    request<ScheduledAssignment>('PATCH', `/api/scheduled-assignments/${id}`, b),
  deleteScheduledAssignment: (id: number) =>
    request<void>('DELETE', `/api/scheduled-assignments/${id}`),

  // PRN
  listPrnAssignments: () => request<PrnAssignment[]>('GET', '/api/prn-assignments'),
  createPrnAssignment: (b: Partial<PrnAssignment>) =>
    request<PrnAssignment>('POST', '/api/prn-assignments', b),
  updatePrnAssignment: (id: number, b: Partial<PrnAssignment>) =>
    request<PrnAssignment>('PATCH', `/api/prn-assignments/${id}`, b),
  deletePrnAssignment: (id: number) =>
    request<void>('DELETE', `/api/prn-assignments/${id}`),

  // away
  listAway: () => request<AwayPeriod[]>('GET', '/api/away-periods'),
  createAway: (b: Partial<AwayPeriod>) =>
    request<AwayPeriod>('POST', '/api/away-periods', b),
  deleteAway: (id: number) => request<void>('DELETE', `/api/away-periods/${id}`),

  // day grid
  getDay: (date?: string) =>
    request<DayPayload>('GET', `/api/day${date ? `?date=${date}` : ''}`),

  // scheduled-dose-log taps
  dispense: (id: number, by?: string | null) =>
    request<DayLog>('POST', `/api/scheduled-dose-logs/${id}/dispense`, { by: by ?? null }),
  undispense: (id: number) =>
    request<DayLog>('POST', `/api/scheduled-dose-logs/${id}/undispense`),
  take: (id: number) =>
    request<DayLog>('POST', `/api/scheduled-dose-logs/${id}/take`),
  untake: (id: number) =>
    request<DayLog>('POST', `/api/scheduled-dose-logs/${id}/untake`),

  // PRN today
  getPrnToday: (date?: string) =>
    request<PrnToday>('GET', `/api/prn-today${date ? `?date=${date}` : ''}`),
  logPrnDose: (b: {
    assignment_id: number;
    dispensed?: boolean;
    dispensed_by?: string | null;
  }) => request<PrnLog>('POST', '/api/prn-dose-logs', b),
  attributePrnLog: (id: number, dispensed_by: string | null) =>
    request<PrnLog>('PATCH', `/api/prn-dose-logs/${id}`, { dispensed_by }),
  deletePrnLog: (id: number) => request<void>('DELETE', `/api/prn-dose-logs/${id}`),

  // upload
  uploadImage: async (
    file: File,
    kind: 'person' | 'med-box' | 'med-box-back' | 'med-tablet'
  ): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>(
      'POST',
      `/api/uploads?kind=${kind}`,
      fd
    );
  },

  // AI extraction
  listAiModels: () => request<AiModelsResponse>('GET', '/api/ai/models'),
  extractMedication: (b: { image_urls: string[]; model?: string }) =>
    request<ExtractResponse>('POST', '/api/medications/extract', b),
};
