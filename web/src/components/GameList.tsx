import { formatDate } from '../format'
import type { GameRow } from '../types'

interface GameListProps {
  rows: GameRow[] | null
  loading: boolean
  error: string | null
}

export default function GameList({ rows, loading, error }: GameListProps) {
  if (loading) return <p className="hint">경기 기록을 불러오는 중입니다.</p>
  if (error) {
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    )
  }
  if (!rows || rows.length === 0) return <p className="empty">아직 입력된 경기 기록이 없습니다.</p>

  return (
    <ul className="data-list">
      {rows.map((row) => (
        <li key={row.id} className="data-row">
          <div className="data-row-main">
            <span className="data-row-title">{formatDate(row.played_on)}</span>
            <span className="data-row-meta">
              {[row.competition, row.opponent].filter((value) => value && value.trim()).join(' · ') ||
                '경기'}
            </span>
          </div>
          <span className="data-row-meta">
            {row.at_bats}타수 {row.hits}안타 {row.walks}볼넷
          </span>
        </li>
      ))}
    </ul>
  )
}
