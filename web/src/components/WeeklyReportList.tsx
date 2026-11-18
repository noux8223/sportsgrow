import { formatAverage, formatDate, formatGoalTarget, formatNumber } from '../format'
import type { WeeklyReport, WeeklyReportBody } from '../types'

interface WeeklyReportListProps {
  reports: WeeklyReport[] | null
  loading: boolean
  error: string | null
}

function ReportItem({ report }: { report: WeeklyReport }) {
  const body: WeeklyReportBody = report.body_json ?? {}
  const lines: Array<{ label: string; value: string }> = []

  if (body.athleteName !== undefined) lines.push({ label: '선수', value: body.athleteName })
  if (body.trainingMinutes !== undefined) {
    lines.push({ label: '주간 훈련', value: formatNumber(body.trainingMinutes, '분') })
  }
  if (body.trainingDays !== undefined) {
    lines.push({ label: '훈련 일수', value: formatNumber(body.trainingDays, '일') })
  }
  if (body.games !== undefined) lines.push({ label: '경기', value: formatNumber(body.games, '경기') })
  if (body.hits !== undefined) lines.push({ label: '안타', value: formatNumber(body.hits, '개') })
  if (body.atBats !== undefined) lines.push({ label: '타수', value: formatNumber(body.atBats, '타수') })
  if (body.weekBattingAverage !== undefined) {
    lines.push({ label: '주간 타율', value: formatAverage(body.weekBattingAverage) })
  }
  if (body.photoCount !== undefined) {
    lines.push({ label: '사진', value: formatNumber(body.photoCount, '장') })
  }

  const goals = body.goals ?? []
  const notes = (body.notes ?? []).filter(
    (note) => typeof note.body === 'string' && note.body.trim().length > 0,
  )

  return (
    <li className="data-row">
      <div className="data-row-main">
        <span className="data-row-title">{formatDate(report.week_start)} 주간 리포트</span>
      </div>

      {lines.length > 0 ? (
        <dl className="detail-list report-detail">
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {goals.length > 0 ? (
        <ul className="report-goals">
          {goals.map((goal, index) => (
            <li key={`${goal.title ?? 'goal'}-${index}`}>
              {goal.title ?? '목표'}
              {goal.target_numeric !== undefined
                ? ` · ${formatGoalTarget(goal.metric ?? '', goal.target_numeric)}`
                : ''}
            </li>
          ))}
        </ul>
      ) : null}

      {notes.length > 0 ? (
        <ul className="report-notes">
          {notes.map((note, index) => (
            <li key={index}>{note.body}</li>
          ))}
        </ul>
      ) : null}

      {lines.length === 0 && goals.length === 0 && notes.length === 0 ? (
        <p className="empty">표시할 항목이 없습니다.</p>
      ) : null}
    </li>
  )
}

export default function WeeklyReportList({ reports, loading, error }: WeeklyReportListProps) {
  if (loading) return <p className="hint">주간 리포트를 불러오는 중입니다.</p>
  if (error) {
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    )
  }
  if (!reports || reports.length === 0) {
    return <p className="empty">아직 도착한 주간 리포트가 없습니다.</p>
  }

  return (
    <ul className="data-list">
      {reports.map((report) => (
        <ReportItem key={report.id} report={report} />
      ))}
    </ul>
  )
}
