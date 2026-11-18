import type { Membership, Session, SessionUser } from './types'

const CLIENT_HEADER = 'x-sportsgrow-client'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') headers[CLIENT_HEADER] = '1'

  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'network_error', '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; message?: string }
    throw new ApiError(
      response.status,
      body.error ?? 'request_failed',
      body.message ?? '요청을 처리하지 못했습니다.',
    )
  }
  return payload as T
}

interface LoginResponse {
  user: Omit<SessionUser, 'platformStaff'>
  memberships: Membership[]
  activeMembershipId: string | null
  platformStaff: boolean
}

export async function login(email: string, password: string): Promise<void> {
  await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function fetchSession(): Promise<Session> {
  return request<Session>('/api/me')
}

export async function selectMembership(membershipId: string): Promise<void> {
  await request<{ activeMembershipId: string }>('/api/session/active-membership', {
    method: 'POST',
    body: { membershipId },
  })
}

export async function logout(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' })
}
