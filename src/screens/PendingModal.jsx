// 미접수자 확인 — 마감 직전에 "누가 아직 안 왔지?" 를 확인하는 화면

import { useMemo, useState } from 'react'
import { lcLabel, lcRangeOfDay, formatPhone } from '../lib/format'
import { downloadCsv, today } from '../lib/download'
import { Button, Empty, Modal, Tag } from '../components/UI'

export default function PendingModal({ open, onClose, roster, settings, showToast }) {
  const lcPerDay = settings.lc_per_day || 31
  const totalDays = settings.total_days || 3

  const [day, setDay] = useState('all')
  const [lc, setLc] = useState('all')

  // 일차 필터를 적용한 미접수자
  const pendingByDay = useMemo(() => {
    const list = roster.filter((p) => !p.checked_in_at)
    if (day === 'all') return list
    const [min, max] = lcRangeOfDay(Number(day), lcPerDay)
    return list.filter((p) => p.lc >= min && p.lc <= max)
  }, [roster, day, lcPerDay])

  // '전체' 일 때는 LC가 90개 넘게 쏟아져 오히려 보기 힘들어서, 일차를 고른 뒤에만 보여줍니다.
  const lcOptions = useMemo(
    () => (day === 'all' ? [] : [...new Set(pendingByDay.map((p) => p.lc))].sort((a, b) => a - b)),
    [pendingByDay, day]
  )

  const pending = useMemo(() => {
    const list = lc === 'all' ? pendingByDay : pendingByDay.filter((p) => p.lc === Number(lc))
    return [...list].sort((a, b) => a.lc - b.lc || a.name.localeCompare(b.name, 'ko'))
  }, [pendingByDay, lc])

  // LC별로 묶어서 보여줍니다
  const grouped = useMemo(() => {
    const map = new Map()
    for (const p of pending) {
      if (!map.has(p.lc)) map.set(p.lc, [])
      map.get(p.lc).push(p)
    }
    return [...map.entries()]
  }, [pending])

  const copyList = async () => {
    const text = grouped
      .map(([lcNum, people]) => `[${lcLabel(lcNum)}] ${people.map((p) => p.name).join(', ')}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      showToast(`미접수자 ${pending.length}명을 복사했습니다.`, 'success')
    } catch {
      showToast('복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'error')
    }
  }

  const exportCsv = () => {
    downloadCsv(
      `미접수자_${today()}`,
      ['이름', 'LC', '계열', '연락처'],
      pending.map((p) => [p.name, lcLabel(p.lc), p.dept || '', formatPhone(p.phone) || ''])
    )
    showToast('CSV 파일을 내려받았습니다.', 'success')
  }

  return (
    <Modal open={open} onClose={onClose} title="미접수자" wide>
      {/* 필터 ---------------------------------------------------------- */}
      <div className="stack-s" style={{ marginBottom: 18 }}>
        <div className="chips">
          <button
            className={`chip ${day === 'all' ? 'is-on' : ''}`}
            onClick={() => {
              setDay('all')
              setLc('all')
            }}
          >
            전체
          </button>
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              className={`chip ${day === String(d) ? 'is-on' : ''}`}
              onClick={() => {
                setDay(String(d))
                setLc('all')
              }}
            >
              {d}일차
            </button>
          ))}
        </div>

        {lcOptions.length > 1 && (
          <div className="chips">
            <button
              className={`chip chip--sm ${lc === 'all' ? 'is-on' : ''}`}
              onClick={() => setLc('all')}
            >
              LC 전체
            </button>
            {lcOptions.map((n) => (
              <button
                key={n}
                className={`chip chip--sm ${lc === String(n) ? 'is-on' : ''}`}
                onClick={() => setLc(String(n))}
              >
                {lcLabel(n)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 요약 + 내보내기 ------------------------------------------------ */}
      <div
        className="panel row"
        style={{ justifyContent: 'space-between', marginBottom: 16, padding: '14px 18px' }}
      >
        <div>
          <span className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em' }}>
            {pending.length}
          </span>
          <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            명 미접수
          </span>
        </div>
        {pending.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <Button variant="ghost" size="sm" onClick={copyList}>
              복사
            </Button>
            <Button variant="ghost" size="sm" onClick={exportCsv}>
              CSV
            </Button>
          </div>
        )}
      </div>

      {/* 목록 ---------------------------------------------------------- */}
      {pending.length === 0 ? (
        <Empty icon="check" title="미접수자가 없습니다" desc="전원 접수 완료되었습니다." />
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {grouped.map(([lcNum, people]) => (
            <section key={lcNum}>
              <div className="section-head">
                <span className="section-head__title">{lcLabel(lcNum)}</span>
                <span className="section-head__count">{people.length}명</span>
              </div>
              <div className="list">
                {people.map((p) => (
                  <div key={p.id} className="list__row">
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                    <span className="row-end" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {p.dept && <Tag>{p.dept}</Tag>}
                      {p.phone && (
                        <span className="num" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>
                          {formatPhone(p.phone)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}
