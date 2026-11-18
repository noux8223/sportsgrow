import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api'

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>
  bootError: string | null
}

export default function LoginPage({ onLogin, bootError }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    try {
      await onLogin(email.trim(), password)
    } catch (loginError) {
      setError(
        loginError instanceof ApiError
          ? loginError.message
          : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-intro">
        <span className="brand-mark" aria-hidden="true">
          SG
        </span>
        <h1>Sports Grow</h1>
        <p>선수, 보호자, 코치, 아카데미가 같은 기록을 봅니다.</p>
        <ul>
          <li>훈련과 경기 기록</li>
          <li>목표와 주간 리포트</li>
          <li>아카데미 단위 관리</li>
        </ul>
      </section>

      <section className="auth-card">
        <h2>로그인</h2>
        <p className="lead">아카데미 계정으로 로그인해 주세요.</p>

        {bootError ? (
          <p className="alert" role="alert">
            {bootError}
          </p>
        ) : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>이메일</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" className="primary" disabled={pending}>
            {pending ? '로그인 중입니다' : '로그인'}
          </button>
        </form>

        <p className="footnote">계정은 아카데미 관리자가 발급합니다. 비밀번호를 잊었다면 관리자에게 문의해 주세요.</p>
      </section>
    </div>
  )
}
