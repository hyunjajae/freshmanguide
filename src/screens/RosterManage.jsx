// 전체 명단 관리 — 쭉 보고, 찾고, 잘못 올라간 사람을 지웁니다.
// ------------------------------------------------------------------
// 1,600명을 한 번에 그리면 폰에서 버벅이므로 100명씩 끊어서 보여주고
// [더 보기] 로 늘립니다.

import { useMemo, useState } from 'react'
import * as api from '../lib/api'
import { toChosung, isChosungQuery } from '../lib/korean'
import { formatPhone, lcLabel, dayOfLc, lcRangeOfDay, timeOnly, normalizePhone } from '../lib/format'
import { Button, Empty, Icon, Tag } from '../components/UI'

const PAGE = 100

export default function RosterManage({
  session,
  settings,
  roster,
  removeParticipant,
  onError,
  showToast,
}) {
  const lcPerDay = settings.lc_per_day || 31
  const totalDays = settings.total_days || 3

  const [query, setQuery] = useState('')
  const [day, setDay] = useState('all')
  const [status, setStatus] = useState('all') // all | done | pending
  const [limit, setLimit] = useState(PAGE)
  const [busyId, setBusyId] = useState(null)

  // ── 걸러내기 ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim()
    let list = roster

    if (day !== 'all') {
      const [min, max] = lcRangeOfDay(Number(day), lcPerDay)
      list = list.filter((p) => p.lc >= min && p.lc <= max)
    }
    if (status === 'done') list = list.filter((p) => p.checked_in_at)
    if (status === 'pending') list = list.filter((p) => !p.checked_in_at)

    if (q) {
      const digits = /^[0-9]+$/.test(q)
      const chosung = isChosungQuery(q)
      const lower = q.toLowerCase()

      list = list.filter((p) => {
        // 숫자만 쳤을 때
        //   1~2자리 → LC 번호 (LC는 최대 두 자리라 이게 훨씬 자연스럽습니다)
        //   3자리 이상 → 연락처
        // 이렇게 안 나누면 "17" 을 쳤을 때 전화번호에 17이 든 사람이 전부 걸립니다.
        if (digits) {
          return q.length <= 2 ? String(p.lc) === String(Number(q)) : normalizePhone(p.phone).includes(q)
        }
        if (chosung) return toChosung(p.name || '').includes(q)
        return (p.name || '').toLowerCase().includes(lower)
      })
    }

    return [...list].sort((a, b) => a.lc - b.lc || a.name.localeCompare(b.name, 'ko'))
  }, [roster, query, day, status, lcPerDay])

  const shown = filtered.slice(0, limit)
  const doneCount = useMemo(() => filtered.filter((p) => p.checked_in_at).length, [filtered])

  const resetLimit = (fn) => (v) => {
    setLimit(PAGE)
    fn(v)
  }

  // ── 삭제 ──────────────────────────────────────────────────────────
  const handleDelete = async (p) => {
    const warn = p.checked_in_at
      ? `\n\n⚠️ 이미 접수 완료된 참가자입니다 (${timeOnly(p.checked_in_at)}).`
      : ''
    if (!window.confirm(`${p.name} (${lcLabel(p.lc)})\n명단에서 완전히 지웁니다.${warn}\n\n되돌릴 수 없습니다. 계속할까요?`)) {
      return
    }

    setBusyId(p.id)
    try {
      const res = await api.deleteParticipant(session.token, p.id)
      if (!res?.ok) {
        showToast(res?.message || '삭제에 실패했습니다.', 'error')
        return
      }
      removeParticipant(p.id)
      showToast(`${p.name}님을 명단에서 지웠습니다.`, 'info')
    } catch (err) {
      onError(err, '삭제에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      {/* 검색 ---------------------------------------------------------- */}
      <div className="input-wrap">
        <input
          className="input"
          value={query}
          onChange={(e) => resetLimit(setQuery)(e.target.value)}
          placeholder="이름 · 초성 · LC 번호 · 연락처"
          autoComplete="off"
          spellCheck={false}
          aria-label="명단 검색"
        />
        {query && (
          <button
            className="input-clear"
            onClick={() => resetLimit(setQuery)('')}
            aria-label="지우기"
          >
            <Icon.close />
          </button>
        )}
      </div>

      {/* 거르기 -------------------------------------------------------- */}
      <div className="stack-s">
        <div className="chips">
          <button
            className={`chip ${day === 'all' ? 'is-on' : ''}`}
            onClick={() => resetLimit(setDay)('all')}
          >
            전체 일차
          </button>
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              className={`chip ${day === String(d) ? 'is-on' : ''}`}
              onClick={() => resetLimit(setDay)(String(d))}
            >
              {d}일차
            </button>
          ))}
        </div>

        <div className="chips">
          {[
            ['all', '전체'],
            ['done', '접수 완료'],
            ['pending', '미접수'],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`chip chip--sm ${status === k ? 'is-on' : ''}`}
              onClick={() => resetLimit(setStatus)(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 ---------------------------------------------------------- */}
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <span className="section-head__title">검색 결과</span>
        <span className="num" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>
          {filtered.length.toLocaleString()}명
          <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            접수 {doneCount.toLocaleString()}
          </span>
        </span>
      </div>

      {/* 목록 ---------------------------------------------------------- */}
      {filtered.length === 0 ? (
        <Empty
          icon="user"
          title={roster.length === 0 ? '등록된 참가자가 없습니다' : '조건에 맞는 참가자가 없습니다'}
          desc={roster.length === 0 ? '업로드 탭에서 명단을 올려주세요.' : undefined}
        />
      ) : (
        <>
          <div className="list">
            {shown.map((p) => (
              <div key={p.id} className="list__row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em' }}>
                      {p.name}
                    </span>
                    <Tag tone="accent">{lcLabel(p.lc)}</Tag>
                    <Tag tone="line">{dayOfLc(p.lc, lcPerDay)}일차</Tag>
                    {p.is_walkin && <Tag tone="warn">현장</Tag>}
                    {p.checked_in_at ? (
                      <Tag tone="accent">접수 {timeOnly(p.checked_in_at)}</Tag>
                    ) : (
                      <Tag>미접수</Tag>
                    )}
                  </div>
                  <div
                    className="num"
                    style={{ marginTop: 5, fontSize: 13.5, color: 'var(--text-soft)' }}
                  >
                    {p.dept || '계열 없음'}
                    {p.phone && ` · ${formatPhone(p.phone)}`}
                  </div>
                </div>

                <Button
                  variant="danger-quiet"
                  size="sm"
                  loading={busyId === p.id}
                  onClick={() => handleDelete(p)}
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>

          {filtered.length > shown.length && (
            <Button variant="ghost" block onClick={() => setLimit((n) => n + PAGE)}>
              더 보기 ({shown.length.toLocaleString()} / {filtered.length.toLocaleString()})
            </Button>
          )}
        </>
      )}

      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
        여기서 지운 사람은 되돌릴 수 없습니다. 행사 당일에 실수로 지웠다면
        접수 화면의 <b>현장 등록</b> 으로 다시 넣을 수 있습니다.
      </p>
    </div>
  )
}
