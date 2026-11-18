export interface Membership {
  id: string
  orgId: string
  orgName: string
  role: string
  athleteIds: string[]
}

export interface SessionUser {
  id: string
  email: string
  name: string
  platformStaff: boolean
}

export interface Session {
  user: SessionUser
  memberships: Membership[]
  activeMembershipId: string | null
}

const ROLE_LABELS: Record<string, string> = {
  athlete: '선수',
  guardian: '보호자',
  coach: '코치',
  org_admin: '기관 관리자',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export function isMinorRole(role: string): boolean {
  return role === 'athlete' || role === 'guardian'
}
