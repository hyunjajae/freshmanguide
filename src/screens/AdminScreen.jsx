// 접수처(관리자) 화면
// ------------------------------------------------------------------
// 검색 → 접수 / 취소 가 초 단위로 반복되는 화면이라 속도를 최우선으로 만들었습니다.
//   · 검색은 서버를 거치지 않습니다 (로그인할 때 명단을 전부 받아둠) → 타이핑 즉시 결과
//   · 접수 버튼은 누르는 즉시 화면이 바뀌고, 실패하면 되돌립니다
//   · Enter 키만으로 검색 → 접수까지 처리 가능 (미접수자가 1명일 때)

import { useMemo, useRef, useState } from 'react'
import * as api from '../lib/api'
import { broadcastCheckin } from '../lib/realtime'
import { toChosung, isChosungQuery } from '../lib/korean'
import { formatPhone, lcLabel, dayOfLc, timeOnly, normalizePhone, percent } from '../lib/format'
import { Button, Empty, Icon, Input, Meter, Spinner, Tag } from '../components/UI'
import StatsModal from './StatsModal'
import PendingModal from './PendingModal'
import WalkinModal from './WalkinModal'

const MAX_RESULTS = 40

export default function AdminScreen({
  session,
  settings,
  roster,
  rosterLoading,
  refreshRoster,
  patchParticipant,
  addParticipant,
  onLogout,
  onOpenManage,
  onError,
  showToast,
}) {
  const [query, setQuery] = useState('')
  const [lcFilter, setLcFilter] = useState('')
  const [busyIds, setBusyIds] = useState(new Set())
  const [flashId, setFlashId] = useState(null)
  const [modal, setModal] = useState(null) // 'stats' | 'pending' | 'walkin'
  const searchRef = useRef(null)

  const totalDone = useMemo(() => roster.filter((p) => p.checked_in_at).length, [roster])
  const donePct = percent(totalDone, roster.length)

  // ── 검색 ──────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim()
    const lcNum = lcFilter.trim() ? parseInt(lcFilter.replace(/[^0-9]/g, ''), 10) : null

    if (!q && lcNum === null) return null

    // 이름을 안 쳤고 LC만 골랐다면 그 LC 전체를 보여줍니다
    if (!q && lcNum !== null) {
      return roster
        .filter((p) => p.lc === lcNum)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .slice(0, 200)
    }

    const digitsOnly = /^[0-9]+$/.test(q)
    const chosungMode = isChosungQuery(q)
    const qLower = q.toLowerCase()

    const scored = []

    for (const p of roster) {
      if (lcNum !== null && p.lc !== lcNum) continue

      const name = p.name || ''
      let score = -1

      if (digitsOnly && q.length >= 3) {
        // 숫자만 입력하면 연락처 뒷자리 검색
        const phone = normalizePhone(p.phone)
        if (phone.includes(q)) score = phone.endsWith(q) ? 1 : 3
      } else if (chosungMode) {
        const cho = toChosung(name)
        if (cho === q) score = 0
        else if (cho.startsWith(q)) score = 1
        else if (cho.includes(q)) score = 2
      } else {
        const nameLower = name.toLowerCase()
        if (nameLower === qLower) score = 0 // 완전 일치가 최우선
        else if (nameLower.startsWith(qLower)) score = 1
        else if (nameLower.includes(qLower)) score = 2
      }

      if (score >= 0) scored.push({ p, score })
    }

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      // 미접수를 위로 (접수해야 할 사람이 먼저 보이도록)
      const aDone = a.p.checked_in_at ? 1 : 0
      const bDone = b.p.checked_in_at ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return a.p.lc - b.p.lc
    })

    return scored.slice(0, MAX_RESULTS).map((s) => s.p)
  }, [query, lcFilter, roster])

  const setBusy = (id, on) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // ── 접수 처리 ─────────────────────────────────────────────────────
  const handleCheckIn = async (p) => {
    if (busyIds.has(p.id)) return
    setBusy(p.id, true)

    patchParticipant(p.id, { checked_in_at: new Date().toISOString() }) // 먼저 화면부터
    setFlashId(p.id)
    setTimeout(() => setFlashId(null), 1200)

    try {
      const res = await api.checkIn(session.token, p.id)

      if (!res?.ok) {
        if (res?.already) {
          // 다른 창구에서 이미 처리한 경우 — 서버 값으로 맞춰줍니다
          patchParticipant(p.id, { checked_in_at: res.participant?.checked_in_at })
          showToast(res.message, 'warn')
        } else {
          patchParticipant(p.id, { checked_in_at: null }) // 되돌리기
          showToast(res?.message || '접수에 실패했습니다.', 'error')
        }
        return
      }

      const serverTime = res.participant?.checked_in_at
      patchParticipant(p.id, { checked_in_at: serverTime })
      broadcastCheckin({ id: p.id, lc: p.lc, checkedInAt: serverTime, kind: 'checkin' })
      showToast(`${p.name}님 접수 완료`, 'success')
    } catch (err) {
      patchParticipant(p.id, { checked_in_at: null }) // 되돌리기
      onError(err, '접수에 실패했습니다.')
    } finally {
      setBusy(p.id, false)
    }
  }

  // ── 접수 취소 ─────────────────────────────────────────────────────
  const handleUndo = async (p) => {
    if (busyIds.has(p.id)) return
    if (!window.confirm(`${p.name}님의 접수를 취소하시겠습니까?`)) return

    setBusy(p.id, true)
    const before = p.checked_in_at
    patchParticipant(p.id, { checked_in_at: null })

    try {
      const res = await api.undoCheckIn(session.token, p.id)
      if (!res?.ok) {
        patchParticipant(p.id, { checked_in_at: before })
        showToast(res?.message || '취소에 실패했습니다.', 'error')
        return
      }
      broadcastCheckin({ id: p.id, lc: p.lc, checkedInAt: null, kind: 'undo' })
      showToast(`${p.name}님 접수를 취소했습니다.`, 'info')
    } catch (err) {
      patchParticipant(p.id, { checked_in_at: before })
      onError(err, '취소에 실패했습니다.')
    } finally {
      setBusy(p.id, false)
    }
  }

  // Enter: 결과가 미접수 1명뿐이면 바로 접수합니다 (줄이 길 때 속도용)
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const pending = (results || []).filter((p) => !p.checked_in_at)
    if (pending.length === 1) handleCheckIn(pending[0])
  }

  const clearSearch = () => {
    setQuery('')
    setLcFilter('')
    searchRef.current?.focus()
  }

  return (
    <div className="app has-dock">
      {/* 상단 바 ------------------------------------------------------ */}
      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__left">
            <img className="topbar__logo" src="/logo.png" alt="" />
            <div className="brand">
              <span className="brand__eyebrow">Check-in Desk</span>
              <span className="brand__name">접수처</span>
            </div>
          </div>

          <div className="topbar__right">
            <button
              className="icon-btn"
              onClick={() => refreshRoster()}
              disabled={rosterLoading}
              aria-label="명단 갱신"
              title="명단 갱신"
            >
              {rosterLoading ? <Spinner size={15} /> : <Icon.refresh />}
            </button>
            <button
              className="icon-btn"
              onClick={onOpenManage}
              aria-label="명단 관리"
              title="명단 관리"
            >
              <Icon.settings />
            </button>
            <button className="btn btn--quiet btn--sm" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ paddingTop: 18 }}>
        {/* 접수 현황 --------------------------------------------------- */}
        <div className="deskstat" style={{ marginBottom: 16 }}>
          <div className="deskstat__figure">
            <span className="deskstat__done">{totalDone.toLocaleString()}</span>
            <span className="deskstat__total">/ {roster.length.toLocaleString()}</span>
          </div>
          <div className="deskstat__main">
            <span className="deskstat__label">접수 현황</span>
            <Meter value={donePct} />
          </div>
          <span className="deskstat__pct">{donePct}%</span>
        </div>

        {/* 검색 ------------------------------------------------------- */}
        <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
          <div className="input-wrap" style={{ flex: 1 }}>
            <input
              ref={searchRef}
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="이름"
              autoComplete="off"
              spellCheck={false}
              aria-label="이름 검색"
            />
            {query && (
              <button className="input-clear" onClick={clearSearch} aria-label="지우기">
                <Icon.close />
              </button>
            )}
          </div>
          <input
            className="input"
            style={{ width: 84, flex: 'none', textAlign: 'center' }}
            value={lcFilter}
            onChange={(e) => setLcFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="LC"
            inputMode="numeric"
            autoComplete="off"
            aria-label="LC 번호로 좁히기"
          />
        </div>

        {/* 결과 -------------------------------------------------------- */}
        <div style={{ marginTop: 18 }}>
          {results === null ? (
            <Empty icon="search" title="이름을 입력해주세요" />
          ) : results.length === 0 ? (
            <Empty
              icon="user"
              title="검색 결과가 없습니다"
              desc="명단에 없는 참가자라면 아래 현장 등록을 이용해주세요."
            />
          ) : (
            <>
              <div className="section-head">
                <span className="section-head__title">검색 결과</span>
                <span className="section-head__count">
                  {results.length}명{results.length === MAX_RESULTS && ' +'}
                </span>
              </div>

              <div className="list rise">
                {results.map((p) => (
                  <PersonRow
                    key={p.id}
                    p={p}
                    lcPerDay={settings.lc_per_day}
                    busy={busyIds.has(p.id)}
                    flash={flashId === p.id}
                    onCheckIn={() => handleCheckIn(p)}
                    onUndo={() => handleUndo(p)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* 하단 고정 바 -------------------------------------------------- */}
      <nav className="dock">
        <div className="dock__inner">
          <button className="dock-btn dock-btn--accent" onClick={() => setModal('walkin')}>
            <Icon.plus />
            <span>현장 등록</span>
          </button>
          <button className="dock-btn" onClick={() => setModal('pending')}>
            <Icon.clipboard />
            <span>미접수자</span>
          </button>
          <button className="dock-btn" onClick={() => setModal('stats')}>
            <Icon.chart />
            <span>통계</span>
          </button>
        </div>
      </nav>

      {/* 모달 ---------------------------------------------------------- */}
      <WalkinModal
        open={modal === 'walkin'}
        onClose={() => setModal(null)}
        session={session}
        settings={settings}
        onAdded={(participant) => {
          addParticipant(participant)
          broadcastCheckin({
            id: participant.id,
            lc: participant.lc,
            checkedInAt: participant.checked_in_at,
            kind: 'walkin',
          })
        }}
        onError={onError}
        showToast={showToast}
      />

      <PendingModal
        open={modal === 'pending'}
        onClose={() => setModal(null)}
        roster={roster}
        settings={settings}
        showToast={showToast}
      />

      <StatsModal
        open={modal === 'stats'}
        onClose={() => setModal(null)}
        session={session}
        settings={settings}
        onError={onError}
      />
    </div>
  )
}

/** 검색 결과 한 줄 */
function PersonRow({ p, lcPerDay, busy, flash, onCheckIn, onUndo }) {
  const done = Boolean(p.checked_in_at)
  const day = dayOfLc(p.lc, lcPerDay)

  return (
    <div className={`person ${done ? 'is-done' : ''} ${flash ? 'flash' : ''}`}>
      <div className="person__main">
        <div className="person__name">{p.name}</div>

        <div className="person__tags">
          <Tag tone="accent">{lcLabel(p.lc)}</Tag>
          {day && <Tag tone="line">{day}일차</Tag>}
          {p.dept && <Tag>{p.dept}</Tag>}
          {p.is_walkin && <Tag tone="warn">현장</Tag>}
        </div>

        {p.phone && (
          <div className="person__meta">
            <span>
              <i>연락처</i>
              {formatPhone(p.phone)}
            </span>
          </div>
        )}

        {done && <div className="person__stamp">{timeOnly(p.checked_in_at)} 접수 완료</div>}
      </div>

      <div className="person__action">
        {done ? (
          <Button variant="danger-quiet" size="sm" onClick={onUndo} loading={busy}>
            취소
          </Button>
        ) : (
          <Button variant="solid" onClick={onCheckIn} loading={busy} style={{ minWidth: 92 }}>
            접수
          </Button>
        )}
      </div>
    </div>
  )
}
