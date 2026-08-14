// 명단 내보내기 — 행사가 끝난 뒤 결과를 엑셀로 남기기 위한 화면

import { useMemo, useState } from 'react'
import { downloadCsv, today } from '../lib/download'
import { lcLabel, dayOfLc, formatPhone, timeOnly, percent } from '../lib/format'
import { Button } from '../components/UI'

const SCOPES = [
  { id: 'all', label: '전체' },
  { id: 'done', label: '접수 완료만' },
  { id: 'pending', label: '미접수만' },
]

export default function RosterExport({ roster, settings, showToast }) {
  const lcPerDay = settings.lc_per_day || 31
  const totalDays = settings.total_days || 3

  const [scope, setScope] = useState('all')
  const [day, setDay] = useState('all')

  const rows = useMemo(() => {
    let list = [...roster]

    if (scope === 'done') list = list.filter((p) => p.checked_in_at)
    if (scope === 'pending') list = list.filter((p) => !p.checked_in_at)

    if (day !== 'all') {
      const d = Number(day)
      list = list.filter((p) => dayOfLc(p.lc, lcPerDay) === d)
    }

    return list.sort((a, b) => a.lc - b.lc || a.name.localeCompare(b.name, 'ko'))
  }, [roster, scope, day, lcPerDay])

  const doneCount = useMemo(() => rows.filter((p) => p.checked_in_at).length, [rows])

  const handleDownload = () => {
    if (rows.length === 0) {
      showToast('내보낼 데이터가 없습니다.', 'warn')
      return
    }

    const headers = ['이름', 'LC', '일차', '계열', '연락처', '접수여부', '접수시각', '현장등록']
    const body = rows.map((p) => [
      p.name,
      lcLabel(p.lc),
      dayOfLc(p.lc, lcPerDay) ?? '',
      p.dept || '',
      // 앞의 0이 사라지지 않도록 하이픈을 넣은 형태로 씁니다
      formatPhone(p.phone) || '',
      p.checked_in_at ? 'O' : 'X',
      p.checked_in_at ? timeOnly(p.checked_in_at) : '',
      p.is_walkin ? 'O' : '',
    ])

    const scopeName = scope === 'done' ? '접수완료' : scope === 'pending' ? '미접수' : '전체'
    const dayName = day === 'all' ? '' : `_${day}일차`

    downloadCsv(`팀빌딩_${scopeName}${dayName}_${today()}`, headers, body)
    showToast(`${rows.length.toLocaleString()}명을 내려받았습니다.`, 'success')
  }

  return (
    <section className="card">
      <div className="card__body stack" style={{ gap: 16 }}>
        <div className="section-head" style={{ margin: 0 }}>
          <span className="section-head__title">명단 내보내기</span>
        </div>

        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.65 }}>
          행사가 끝난 뒤 결과를 엑셀로 남길 때 쓰세요. 접수 여부와 접수 시각이 함께 저장됩니다.
        </p>

        <div className="stack-s">
          <div className="chips">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                className={`chip ${scope === s.id ? 'is-on' : ''}`}
                onClick={() => setScope(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="chips">
            <button
              className={`chip chip--sm ${day === 'all' ? 'is-on' : ''}`}
              onClick={() => setDay('all')}
            >
              전체 일차
            </button>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                className={`chip chip--sm ${day === String(d) ? 'is-on' : ''}`}
                onClick={() => setDay(String(d))}
              >
                {d}일차
              </button>
            ))}
          </div>
        </div>

        <div
          className="panel row"
          style={{ justifyContent: 'space-between', backgroundColor: 'var(--surface-2)', border: 0 }}
        >
          <span className="section-head__title">내보낼 인원</span>
          <span className="num" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>
            {rows.length.toLocaleString()}명
            {rows.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--muted)' }}>
                접수 {doneCount.toLocaleString()} · {percent(doneCount, rows.length)}%
              </span>
            )}
          </span>
        </div>

        <Button variant="solid" block onClick={handleDownload} disabled={rows.length === 0}>
          CSV로 내려받기
        </Button>

        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          엑셀에서 바로 열립니다. 명단을 새로 올리기 전에 한 번 받아두면 작년 기록이 남습니다.
        </p>
      </div>
    </section>
  )
}
