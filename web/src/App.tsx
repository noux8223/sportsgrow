import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchSession, login, logout, selectMembership } from './api'
import type { Session } from './types'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'

type Status = 'loading' | 'ready'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [bootError, setBootError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSession()
      .then((next) => {
        if (!cancelled) setSession(next)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          setSession(null)
          return
        }
        setBootError(error instanceof ApiError ? error.message : '세션을 확인하지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = useCallback(async (email: string, password: string) => {
    await login(email, password)
    const next = await fetchSession()
    setSession(next)
    setBootError(null)
  }, [])

  const handleLogout = useCallback(async () => {
    setBusy(true)
    try {
      await logout()
      setSession(null)
      setBootError(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSelectMembership = useCallback(async (membershipId: string) => {
    setBusy(true)
    try {
      await selectMembership(membershipId)
      const next = await fetchSession()
      setSession(next)
    } finally {
      setBusy(false)
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="boot">
        <span className="brand-mark" aria-hidden="true">
          SG
        </span>
        <p role="status">세션을 확인하는 중입니다.</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} bootError={bootError} />
  }

  return (
    <HomePage
      session={session}
      busy={busy}
      onLogout={handleLogout}
      onSelectMembership={handleSelectMembership}
    />
  )
}
