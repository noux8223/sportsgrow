import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { ApiError } from '../api'
import RecordForm from '../components/RecordForm'
import { roleLabel, isMinorRole } from '../types'
import type { Membership, Session, SessionUser } from '../types'

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

function StudentGuardianHome({ membership, user }: { membership: Membership; user: SessionUser }) {
  return (
    <>
      <p className="eyebrow">선수 · 보호자</p>
      <h1>학생·보호자 홈</h1>
      <p className="lead">
        {user.name}님의 훈련과 경기 기록, 목표, 주간 리포트를 {membership.orgName}에서 확인합니다.
      </p>

      <div className="card-grid">
        <article className="card">
          <h2>이번 주 기록</h2>
          <p className="empty">아직 불러온 기록이 없습니다. 기록 API를 연결하면 이 자리에 표시됩니다.</p>
        </article>
        <article className="card">
          <h2>목표</h2>
          <p className="empty">목표는 다음 단계에서 연결합니다.</p>
        </article>
        <article className="card">
          <h2>주간 리포트</h2>
          <p className="empty">리포트 수신 설정과 지난 리포트는 다음 단계에서 연결합니다.</p>
        </article>
      </div>

      <p className="hint">기록 입력은 담당 코치가 코치 홈에서 합니다. 학생과 보호자는 기록을 조회합니다.</p>
    </>
  )
}

function CoachHome({ membership, user }: { membership: Membership; user: SessionUser }) {
  return (
    <>
      <p className="eyebrow">코치</p>
      <h1>코치 홈</h1>
      <p className="lead">
        {user.name}님은 {membership.orgName}에서 담당 선수의 훈련과 경기 기록을 정리합니다.
      </p>

      <div className="card-grid">
        <article className="card">
          <h2>담당 선수</h2>
          <p className="empty">선수 목록은 다음 단계에서 연결합니다.</p>
        </article>
        <article className="card">
          <h2>이번 주 입력</h2>
          <p className="empty">기록 API를 연결하면 최근 입력이 이 자리에 표시됩니다.</p>
        </article>
      </div>

      <RecordForm />
    </>
  )
}

function OrgAdminHome({ membership, user }: { membership: Membership; user: SessionUser }) {
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
          <p className="empty">구성원 관리 API는 다음 단계에서 연결합니다.</p>
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
