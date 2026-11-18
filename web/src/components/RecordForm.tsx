function localToday(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function RecordForm() {
  return (
    <section className="card record-form">
      <div className="card-head">
        <h2>기록 입력</h2>
        <span className="badge badge-quiet">준비 중</span>
      </div>
      <p className="hint">다음 단계에서 기록 API를 연결합니다.</p>

      <form onSubmit={(event) => event.preventDefault()}>
        <div className="field-row">
          <label className="field">
            <span>날짜</span>
            <input type="date" name="date" defaultValue={localToday()} />
          </label>

          <label className="field">
            <span>구분</span>
            <select name="kind" defaultValue="training">
              <option value="training">훈련</option>
              <option value="match">경기</option>
            </select>
          </label>

          <label className="field">
            <span>시간(분)</span>
            <input type="number" name="minutes" min="1" max="600" placeholder="60" />
          </label>
        </div>

        <label className="field">
          <span>메모</span>
          <textarea name="memo" rows={3} placeholder="훈련 내용과 느낀 점을 적어 주세요." />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary" disabled aria-describedby="record-pending">
            저장
          </button>
          <span className="hint" id="record-pending">
            기록 저장은 다음 단계에서 열립니다.
          </span>
        </div>
      </form>
    </section>
  )
}
