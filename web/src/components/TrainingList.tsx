import { formatDate, intensityLabel } from '../format'
import type { TrainingRow } from '../types'

interface TrainingListProps {
  rows: TrainingRow[] | null
  loading: boolean
  error: string | null
}

export default function TrainingList({ rows, loading, error }: TrainingListProps) {
  if (loading) return <p className="hint">훈련 기록을 불러오는 중입니다.</p>
  if (error) {
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    )
  }
  if (!rows || rows.length === 0) return <p className="empty">아직 입력된 훈련 기록이 없습니다.</p>

  return (
    <ul className="data-list">
      {rows.map((row) => (
        <li key={row.id} className="data-row">
          <div className="data-row-main">
            <span className="data-row-title">{formatDate(row.trained_on)}</span>
            <span className="badge badge-quiet">강도 {intensityLabel(row.intensity)}</span>
            <span className="data-row-meta">
              {row.type} · {row.minutes}분
            </span>
          </div>
          {row.memo ? <p className="data-memo">{row.memo}</p> : null}
        </li>
      ))}
    </ul>
  )
}
