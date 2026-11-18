import type { Numeric } from './types'

const INTENSITY_LABELS: Record<string, string> = {
  low: '하',
  mid: '중',
  high: '상',
}

const ATHLETE_STATUS_LABELS: Record<string, string> = {
  active: '활동 중',
  draft: '초안',
  inactive: '이용 중지',
}

export function intensityLabel(value: string): string {
  return INTENSITY_LABELS[value] ?? value
}

export function athleteStatusLabel(status: string): string {
  return ATHLETE_STATUS_LABELS[status] ?? status
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 10).replaceAll('-', '.')
}

export function formatNumber(value: Numeric, unit = ''): string {
  if (value === null || value === undefined || value === '') return '-'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return `${parsed}${unit}`
}

export function formatAverage(value: Numeric): string {
  if (value === null || value === undefined || value === '') return '-'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '-'
  return parsed.toFixed(3)
}

export function formatGoalTarget(metric: string, target: Numeric): string {
  if (metric === 'month_batting_average') return formatAverage(target)
  if (metric === 'week_training_days') return formatNumber(target, '일')
  if (metric === 'season_hits') return formatNumber(target, '개')
  return formatNumber(target)
}
