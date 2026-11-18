import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { ApiError, fetchAthletes, fetchMembers, fetchTraining } from '../api'
import AthleteDashboard from '../components/AthleteDashboard'
import RecordForm from '../components/RecordForm'
import TrainingList from '../components/TrainingList'
import { athleteStatusLabel } from '../format'
import { useAsyncData } from '../hooks/useAsyncData'
import { isMinorRole, roleLabel } from '../types'
import type { Athlete, Membership, Session, SessionUser } from '../types'

interface HomePageProps {
  session: Session
  busy: boolean
  onLogout: () => Promise<void>
  onSelectMembership: (membershipId: string) => Promise<void>
}

function activeMembership(session: Session): Membership | null {
  const chosen = session.memberships.find((member) => member.id === session.activeMembershipId)
  if (chosen) return chosen
  return session.memberships.length === 1 ? session.memberships[0] : null
}

function useAction(onAction: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run() {
    setError(null)
    setPending(true)
    try {
      await onAction()
    } catch (actionError) {
      setError(
        actionError instanceof ApiError
          ? actionError.message
          : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setPending(false)
    }
  }

  return { error, pending, run }
}

function PlatformNotice({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'card notice notice-compact' : 'card notice'}>
      <h2>운영 콘솔</h2>
      <p>운영 콘솔은 이 앱 밖에 있습니다. 플랫폼 운영은 기존 운영 도구에서 진행합니다.</p>
    </section>
  )
}

function AthleteSelector({
  athletes,
  selected,
  onSelect,
}: {
  athletes: Athlete[]
  selected: Athlete
  onSelect: (athleteId: string) => void
}) {
  return (
    <div className="toolbar">
      <label>
        <span>선수 선택</span>
        <select value={selected.id} onChange={(event) => onSelect(event.target.value)}>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.displayName}
              {athlete.teamName ? ` · ${athlete.teamName}` : ''}
            </option>
          ))}
        </select>
      </label>
      <span className="badge badge-quiet">{athleteStatusLabel(selected.status)}</span>
    </div>
  )
}

function StudentGuardianHome({ membership, user }: { membership: Membership; user: SessionUser }) {
  const athletes = useAsyncData(() => fetchAthletes(membership.orgId), `athletes:${membership.orgId}`)
  const [selectedId, setSelectedId] = useState<string | null>(membership.athleteIds[0] ?? null)
  const list = athletes.data ?? []
  const selected = list.find((athlete) => athlete.id === selectedId) ?? list[0] ?? null

  return (
    <>
      <p className="eyebrow">선수 · 보호자</p>
      <h1>학생·보호자 홈</h1>
      <p className="lead">
        {user.name}님의 훈련과 경기 기록, 목표, 주간 리포트를 {membership.orgName}에서 확인합니다.
      </p>

      {athletes.loading ? <p className="hint">선수 정보를 불러오는 중입니다.</p> : null}
      {athletes.error ? (
        <p className="alert" role="alert">
          {athletes.error}
        </p>
      ) : null}

      {!athletes.loading && !athletes.error && list.length === 0 ? (
        <section className="card">
          <p className="empty">연결된 선수가 없습니다. 기관 관리자에게 문의해 주세요.</p>
        </section>
      ) : null}

      {selected ? (
        <>
          {list.length > 1 ? (
            <AthleteSelector athletes={list} selected={selected} onSelect={setSelectedId} />
          ) : (
            <p className="hint">
              {selected.displayName}
              {selected.teamName ? ` · ${selected.teamName}` : ''} ·{' '}
              {athleteStatusLabel(selected.status)}
            </p>
          )}

          <AthleteDashboard key={selected.id} athleteId={selected.id} role={membership.role} />
        </>
      ) : null}

      {membership.role === 'guardian' ? (
        <p className="hint">
          훈련과 경기 기록은 선수 계정과 담당 코치가 저장합니다. 보호자는 기록을 조회합니다.
        </p>
      ) : null}
    </>
  )
}

function CoachAthletePanel({ athlete }: { athlete: Athlete }) {
  const training = useAsyncData(() => fetchTraining(athlete.id), `training:${athlete.id}`)

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>최근 훈련</h2>
          <span className="badge badge-quiet">{athleteStatusLabel(athlete.status)}</span>
        </div>
        <TrainingList rows={training.data} loading={training.loading} error={training.error} />
      </section>

      {athlete.hasAthleteUser ? (
        <section className="card">
          <h2>기록 입력</h2>
          <p className="hint">
            선수 계정이 있어 코치는 이 기록을 쓰지 않습니다. 훈련과 경기 기록은 선수가 직접
            입력합니다.
          </p>
        </section>
      ) : (
        <RecordForm athleteId={athlete.id} onSaved={training.reload} />
      )}
    </>
  )
}

function CoachHome({ membership, user }: { membership: Membership; user: SessionUser }) {
  const athletes = useAsyncData(() => fetchAthletes(membership.orgId), `athletes:${membership.orgId}`)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const list = athletes.data ?? []
  const selected = list.find((athlete) => athlete.id === selectedId) ?? list[0] ?? null

  return (
    <>
      <p className="eyebrow">코치</p>
      <h1>코치 홈</h1>
      <p className="lead">
        {user.name}님은 {membership.orgName}에서 담당 선수의 훈련과 경기 기록을 정리합니다.
      </p>

      <section className="card">
        <h2>담당 선수</h2>
        {athletes.loading ? (
          <p className="hint">담당 선수를 불러오는 중입니다.</p>
        ) : athletes.error ? (
          <p className="alert" role="alert">
            {athletes.error}
          </p>
        ) : list.length === 0 ? (
          <p className="empty">배정된 선수가 없습니다. 기관 관리자에게 배정을 요청해 주세요.</p>
        ) : (
          <ul className="athlete-list">
            {list.map((athlete) => (
              <li key={athlete.id}>
                <button
                  type="button"
                  className={
                    athlete.id === selected?.id ? 'athlete-option is-selected' : 'athlete-option'
                  }
                  onClick={() => setSelectedId(athlete.id)}
                  aria-pressed={athlete.id === selected?.id}
                >
                  <span className="membership-org">{athlete.displayName}</span>
                  <span className="badge badge-quiet">
                    {athlete.teamName ?? athleteStatusLabel(athlete.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? <CoachAthletePanel key={selected.id} athlete={selected} /> : null}
    </>
  )
}

function OrgAdminHome({ membership, user }: { membership: Membership; user: SessionUser }) {
  const members = useAsyncData(() => fetchMembers(membership.orgId), `members:${membership.orgId}`)

  return (
    <>
      <p className="eyebrow">기관 관리자</p>
      <h1>아카데미 홈</h1>
      <p className="lead">
        {user.name}님은 {membership.orgName}의 선수와 코치, 운영 현황을 확인합니다.
      </p>

      <div className="card-grid">
        <article className="card">
          <h2>소속 정보</h2>
          <dl className="detail-list">
            <div>
              <dt>아카데미</dt>
              <dd>{membership.orgName}</dd>
            </div>
            <div>
              <dt>역할</dt>
              <dd>{roleLabel(membership.role)}</dd>
            </div>
          </dl>
        </article>

        <article className="card">
          <h2>구성원</h2>
          {members.loading ? (
            <p className="hint">구성원을 불러오는 중입니다.</p>
          ) : members.error ? (
            <p className="alert" role="alert">
              {members.error}
            </p>
          ) : members.data && members.data.length > 0 ? (
            <ul className="data-list">
              {members.data.map((member) => (
                <li key={member.id} className="data-row">
                  <div className="data-row-main">
                    <span className="data-row-title">{member.name}</span>
                    <span className="badge badge-quiet">{roleLabel(member.role)}</span>
                  </div>
                  <span className="data-row-meta">{member.email}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">등록된 구성원이 없습니다.</p>
          )}
        </article>
      </div>
    </>
  )
}

function RoleHome({ membership, user }: { membership: Membership; user: SessionUser }) {
  if (isMinorRole(membership.role)) {
    return <StudentGuardianHome membership={membership} user={user} />
  }
  if (membership.role === 'coach') {
    return <CoachHome membership={membership} user={user} />
  }
  if (membership.role === 'org_admin') {
    return <OrgAdminHome membership={membership} user={user} />
  }
  return (
    <>
      <p className="eyebrow">{roleLabel(membership.role)}</p>
      <h1>{membership.orgName} 홈</h1>
      <p className="lead">{user.name}님으로 로그인했습니다.</p>
      <p className="empty">이 역할의 화면은 다음 단계에서 추가합니다.</p>
    </>
  )
}

export default function HomePage({ session, busy, onLogout, onSelectMembership }: HomePageProps) {
  const { user } = session
  const active = activeMembership(session)
  const needsChoice = !active && session.memberships.length > 1
  const logout = useAction(onLogout)
  const [choiceError, setChoiceError] = useState<string | null>(null)
  const [choicePending, setChoicePending] = useState(false)

  async function handleChoose(membershipId: string) {
    setChoiceError(null)
    setChoicePending(true)
    try {
      await onSelectMembership(membershipId)
    } catch (error) {
      setChoiceError(
        error instanceof ApiError ? error.message : '소속을 선택하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setChoicePending(false)
    }
  }

  async function handleSwitch(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value
    if (!next || next === session.activeMembershipId) return
    setChoiceError(null)
    setChoicePending(true)
    try {
      await onSelectMembership(next)
    } catch (error) {
      setChoiceError(
        error instanceof ApiError ? error.message : '소속을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setChoicePending(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            SG
          </span>
          <span className="brand-text">Sports Grow</span>
        </div>

        <div className="account">
          <span className="account-name">{user.name}</span>
          <span className="account-email">{user.email}</span>
          <button type="button" className="ghost" onClick={() => void logout.run()} disabled={busy || logout.pending}>
            {logout.pending ? '로그아웃 중' : '로그아웃'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {logout.error ? (
          <p className="alert" role="alert">
            {logout.error}
          </p>
        ) : null}

        {active ? (
          <div className="context-bar">
            <span className="badge">{roleLabel(active.role)}</span>
            <span className="context-org">{active.orgName}</span>
            {session.memberships.length > 1 ? (
              <label className="switch">
                <span>소속 전환</span>
                <select
                  value={active.id}
                  onChange={(event) => void handleSwitch(event)}
                  disabled={choicePending || busy}
                >
                  {session.memberships.map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      {membership.orgName} · {roleLabel(membership.role)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {choiceError ? (
          <p className="alert" role="alert">
            {choiceError}
          </p>
        ) : null}

        {needsChoice ? (
          <section className="card membership-panel">
            <h1>소속 선택</h1>
            <p className="lead">여러 소속에 속해 있습니다. 사용할 소속을 선택해 주세요.</p>
            <ul className="membership-list">
              {session.memberships.map((membership) => (
                <li key={membership.id}>
                  <button
                    type="button"
                    className="membership-option"
                    onClick={() => void handleChoose(membership.id)}
                    disabled={choicePending || busy}
                  >
                    <span className="membership-org">{membership.orgName}</span>
                    <span className="badge badge-quiet">{roleLabel(membership.role)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!active && !needsChoice ? (
          <section className="card membership-panel">
            <h1>{user.platformStaff ? '운영 계정' : '소속 정보 없음'}</h1>
            <p className="lead">
              {user.platformStaff
                ? '이 계정에는 연결된 아카데미 소속이 없습니다.'
                : '연결된 소속이 없습니다. 아카데미 관리자에게 초대를 요청해 주세요.'}
            </p>
            {user.platformStaff ? <PlatformNotice compact /> : null}
          </section>
        ) : null}

        {active ? <RoleHome membership={active} user={user} /> : null}

        {active && user.platformStaff ? <PlatformNotice /> : null}
      </main>
    </div>
  )
}
