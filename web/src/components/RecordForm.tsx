import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, createGame, createTraining } from '../api'
import type { TrainingIntensity } from '../types'

function localToday(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

type RecordKind = 'training' | 'match'

interface RecordFormProps {
  athleteId: string
  onSaved: () => void
}

export default function RecordForm({ athleteId, onSaved }: RecordFormProps) {
  const [kind, setKind] = useState<RecordKind>('training')
  const [date, setDate] = useState(localToday())
  const [type, setType] = useState('')
  const [minutes, setMinutes] = useState('60')
  const [intensity, setIntensity] = useState<TrainingIntensity>('mid')
  const [memo, setMemo] = useState('')
  const [competition, setCompetition] = useState('')
  const [opponent, setOpponent] = useState('')
  const [atBats, setAtBats] = useState('0')
  const [hits, setHits] = useState('0')
  const [walks, setWalks] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  function validationError(): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '날짜를 선택해 주세요.'

    if (kind === 'training') {
      const trimmedType = type.trim()
      if (!trimmedType) return '훈련 종류를 입력해 주세요.'
      if (trimmedType.length > 80) return '훈련 종류는 80자 이하로 입력해 주세요.'
      const parsedMinutes = Number(minutes)
      if (!Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
        return '훈련 시간은 1분 이상 1440분 이하로 입력해 주세요.'
      }
      return null
    }

    const numbers = [Number(atBats), Number(hits), Number(walks)]
    if (numbers.some((value) => !Number.isInteger(value) || value < 0)) {
      return '타수, 안타, 볼넷은 0 이상의 정수로 입력해 주세요.'
    }
    if (numbers[1] > numbers[0]) return '안타는 타수보다 클 수 없습니다.'
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setError(null)
    setSaved(false)

    const invalid = validationError()
    if (invalid) {
      setError(invalid)
      return
    }

    setPending(true)
    try {
      if (kind === 'training') {
        await createTraining(athleteId, {
          trainedOn: date,
          type: type.trim(),
          minutes: Number(minutes),
          intensity,
          memo: memo.trim(),
        })
        setType('')
        setMemo('')
      } else {
        await createGame(athleteId, {
          playedOn: date,
          competition: competition.trim(),
          opponent: opponent.trim(),
          atBats: Number(atBats),
          hits: Number(hits),
          walks: Number(walks),
        })
        setCompetition('')
        setOpponent('')
        setAtBats('0')
        setHits('0')
        setWalks('0')
      }
      setSaved(true)
      onSaved()
    } catch (saveError) {
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : '기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="card record-form">
      <div className="card-head">
        <h2>기록 입력</h2>
        <span className="badge badge-quiet">훈련 · 경기</span>
      </div>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="hint" role="status">
          저장했습니다.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <label className="field">
            <span>날짜</span>
            <input
              type="date"
              name="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>구분</span>
            <select
              name="kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value === 'match' ? 'match' : 'training')
                setError(null)
                setSaved(false)
              }}
            >
              <option value="training">훈련</option>
              <option value="match">경기</option>
            </select>
          </label>
        </div>

        {kind === 'training' ? (
          <>
            <div className="field-row">
              <label className="field">
                <span>훈련 종류</span>
                <input
                  type="text"
                  name="type"
                  maxLength={80}
                  placeholder="타격 훈련"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>시간(분)</span>
                <input
                  type="number"
                  name="minutes"
                  min="1"
                  max="1440"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>강도</span>
                <select
                  name="intensity"
                  value={intensity}
                  onChange={(event) => setIntensity(event.target.value as TrainingIntensity)}
                >
                  <option value="low">하</option>
                  <option value="mid">중</option>
                  <option value="high">상</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>메모</span>
              <textarea
                name="memo"
                rows={3}
                placeholder="훈련 내용과 느낀 점을 적어 주세요."
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <div className="field-row">
              <label className="field">
                <span>대회</span>
                <input
                  type="text"
                  name="competition"
                  placeholder="주말 리그"
                  value={competition}
                  onChange={(event) => setCompetition(event.target.value)}
                />
              </label>

              <label className="field">
                <span>상대</span>
                <input
                  type="text"
                  name="opponent"
                  placeholder="상대 팀"
                  value={opponent}
                  onChange={(event) => setOpponent(event.target.value)}
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>타수</span>
                <input
                  type="number"
                  name="atBats"
                  min="0"
                  value={atBats}
                  onChange={(event) => setAtBats(event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>안타</span>
                <input
                  type="number"
                  name="hits"
                  min="0"
                  value={hits}
                  onChange={(event) => setHits(event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>볼넷</span>
                <input
                  type="number"
                  name="walks"
                  min="0"
                  value={walks}
                  onChange={(event) => setWalks(event.target.value)}
                  required
                />
              </label>
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={pending}>
            {pending ? '저장 중' : '저장'}
          </button>
          <span className="hint">저장하면 목록과 요약을 다시 불러옵니다.</span>
        </div>
      </form>
    </section>
  )
}
