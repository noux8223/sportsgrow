import { fetchGames, fetchSummary, fetchTraining, fetchWeeklyReports } from '../api'
import { formatAverage, formatGoalTarget, formatNumber } from '../format'
import { useAsyncData } from '../hooks/useAsyncData'
import type { WeeklyReport } from '../types'
import GameList from './GameList'
import RecordForm from './RecordForm'
import TrainingList from './TrainingList'
import WeeklyReportList from './WeeklyReportList'

interface AthleteDashboardProps {
  athleteId: string
  role: string
}

export default function AthleteDashboard({ athleteId, role }: AthleteDashboardProps) {
  const summary = useAsyncData(() => fetchSummary(athleteId), `summary:${athleteId}`)
  const training = useAsyncData(() => fetchTraining(athleteId), `training:${athleteId}`)
  const games = useAsyncData(() => fetchGames(athleteId), `games:${athleteId}`)

  const canReadReports = role === 'athlete' || role === 'guardian'
  const reports = useAsyncData(
    () => (canReadReports ? fetchWeeklyReports(athleteId) : Promise.resolve<WeeklyReport[]>([])),
    `reports:${athleteId}:${canReadReports ? 'yes' : 'no'}`,
  )

  function handleSaved() {
    summary.reload()
    training.reload()
    games.reload()
  }

  return (
    <>
      <div className="card-grid">
        <article className="card">
          <h2>이번 주 기록</h2>
          {summary.loading ? (
            <p className="hint">요약을 불러오는 중입니다.</p>
          ) : summary.error ? (
            <p className="alert" role="alert">
              {summary.error}
            </p>
          ) : summary.data ? (
            <dl className="stat-grid">
              <div className="stat">
                <dt>주간 훈련</dt>
                <dd>{formatNumber(summary.data.week_minutes, '분')}</dd>
              </div>
              <div className="stat">
                <dt>훈련 일수</dt>
                <dd>{formatNumber(summary.data.week_days, '일')}</dd>
              </div>
              <div className="stat">
                <dt>연속 훈련</dt>
                <dd>{formatNumber(summary.data.streak, '일')}</dd>
              </div>
              <div className="stat">
                <dt>월간 타율</dt>
                <dd>{formatAverage(summary.data.month_batting_average)}</dd>
              </div>
              <div className="stat">
                <dt>시즌 안타</dt>
                <dd>{formatNumber(summary.data.season_hits, '개')}</dd>
              </div>
            </dl>
          ) : null}
        </article>

        <article className="card">
          <h2>목표</h2>
          {summary.loading ? (
            <p className="hint">목표를 불러오는 중입니다.</p>
          ) : summary.error ? (
            <p className="empty">목표를 불러오지 못했습니다.</p>
          ) : summary.data && summary.data.goals.length > 0 ? (
            <ul className="data-list">
              {summary.data.goals.map((goal) => (
                <li key={goal.id} className="data-row">
                  <span className="data-row-title">{goal.title}</span>
                  <span className="data-row-meta">
                    목표 {formatGoalTarget(goal.metric, goal.targetNumeric)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">표시할 목표가 없습니다.</p>
          )}
        </article>
      </div>

      <section className="card">
        <h2>최근 훈련</h2>
        <TrainingList rows={training.data} loading={training.loading} error={training.error} />
      </section>

      <section className="card">
        <h2>최근 경기</h2>
        <GameList rows={games.data} loading={games.loading} error={games.error} />
      </section>

      {canReadReports ? (
        <section className="card">
          <h2>주간 리포트</h2>
          <WeeklyReportList
            reports={reports.data}
            loading={reports.loading}
            error={reports.error}
          />
        </section>
      ) : null}

      {role === 'athlete' ? <RecordForm athleteId={athleteId} onSaved={handleSaved} /> : null}
    </>
  )
}
