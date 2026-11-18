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

export type Numeric = number | string | null | undefined

export interface Athlete {
  id: string
  displayName: string
  birthDate: string
  status: string
  teamId: string
  teamName?: string
  hasAthleteUser: boolean
}

export interface Goal {
  id: string
  title: string
  metric: string
  targetNumeric: Numeric
}

export interface AthleteSummary {
  week_minutes: Numeric
  week_days: Numeric
  streak: Numeric
  month_batting_average: Numeric
  season_hits: Numeric
  goals: Goal[]
}

export type TrainingIntensity = 'low' | 'mid' | 'high'

export interface TrainingRow {
  id: string
  trained_on: string
  type: string
  minutes: number
  intensity: string
  memo: string | null
}

export interface GameRow {
  id: string
  played_on: string
  competition: string | null
  opponent: string | null
  at_bats: number
  hits: number
  walks: number
}

export interface WeeklyReportGoal {
  title?: string
  metric?: string
  target_numeric?: Numeric
}

export interface WeeklyReportNote {
  body?: string
  created_at?: string
}

export interface WeeklyReportBody {
  weekStart?: string
  athleteName?: string
  trainingMinutes?: Numeric
  trainingDays?: Numeric
  games?: Numeric
  hits?: Numeric
  atBats?: Numeric
  weekBattingAverage?: Numeric
  goals?: WeeklyReportGoal[]
  notes?: WeeklyReportNote[]
  photoCount?: Numeric
}

export interface WeeklyReport {
  id: string
  week_start: string
  body_json: WeeklyReportBody
}

export interface OrgMember {
  id: string
  role: string
  athlete_id: string | null
  user_id: string
  name: string
  email: string
  created_at: string
}
