const DEFAULT_API_BASE = 'http://127.0.0.1:3000';

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? DEFAULT_API_BASE).replace(/\/+$/, '');

export type MemberRole = 'athlete' | 'guardian' | 'coach' | 'org_admin';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  platformStaff?: boolean;
};

export type Membership = {
  id: string;
  orgId: string;
  orgName: string;
  role: MemberRole | string;
  athleteIds: string[];
};

export type Session = {
  user: SessionUser;
  memberships: Membership[];
  activeMembershipId: string | null;
};

export type LoginPayload = {
  user?: SessionUser;
  memberships?: Membership[];
  activeMembershipId?: string | null;
  platformStaff?: boolean;
  sessionToken?: string;
};

export type LoginResult = {
  token: string | null;
  session: Session | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const CLIENT_HEADERS = {
  'x-sportsgrow-client': '1',
  'x-sg-client': 'native',
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...CLIENT_HEADERS };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'network_error', '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const body = isRecord(data) ? data : {};
    const code = typeof body.error === 'string' ? body.error : 'http_error';
    const message =
      typeof body.message === 'string' ? body.message : `요청이 실패했습니다. (${response.status})`;
    throw new ApiError(response.status, code, message);
  }

  return data as T;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const payload = await request<LoginPayload>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = typeof payload.sessionToken === 'string' && payload.sessionToken.length > 0
    ? payload.sessionToken
    : null;
  return { token, session: toSession(payload) };
}

export async function fetchMe(token: string): Promise<Session> {
  const payload = await request<LoginPayload>('/api/me', { token });
  const session = toSession(payload);
  if (!session) {
    throw new ApiError(500, 'invalid_response', '사용자 정보를 받지 못했습니다.');
  }
  return session;
}

function toSession(payload: LoginPayload): Session | null {
  if (!payload.user) return null;
  const platformStaff = payload.platformStaff ?? payload.user.platformStaff;
  return {
    user: { ...payload.user, platformStaff },
    memberships: Array.isArray(payload.memberships) ? payload.memberships : [],
    activeMembershipId: payload.activeMembershipId ?? null,
  };
}

export async function logout(token: string): Promise<void> {
  await request<null>('/api/auth/logout', { method: 'POST', token });
}

export const ROLE_LABELS: Record<string, string> = {
  athlete: '선수',
  guardian: '보호자',
  coach: '코치',
  org_admin: '기관 관리자',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
