// 접수처(관리자) 화면
// ------------------------------------------------------------------
// 검색 → 접수 / 취소 가 초 단위로 반복되는 화면이라 속도를 최우선으로 만들었습니다.
//   · 검색은 서버를 거치지 않습니다 (로그인할 때 명단을 전부 받아둠) → 타이핑 즉시 결과
//   · 접수 버튼은 누르는 즉시 화면이 바뀌고, 실패하면 되돌립니다
//   · Enter 키만으로 검색 → 접수까지 처리 가능

import { useMemo, useRef, useState } from 'react'
import * as api from '../lib/api'
import { broadcastCheckin } from '../lib/realtime'
import { toChosung, isChosungQuery } from '../lib/korean'
import { formatPhone, lcLabel, dayOfLc, timeOnly, normalizePhone } from '../lib/format'
import { Badge, Button, EmptyState, Input, Spinner } from '../components/UI'
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

  const totalDone = useMemo(
    () => roster.filter((p) => p.checked_in_at).length,
    [roster]
  )

  // ── 검색 ──────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim()
    const lcNum = lcFilter.trim() ? parseInt(lcFilter.replace(/[^0-9]/g, ''), 10) : null

    // 이름을 안 쳤고 LC만 골랐다면 그 LC 전체를 보여줍니다
    if (!q && lcNum === null) return null
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
        if (nameLower === qLower) score = 0          // 완전 일치가 최우선
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

    const optimisticTime = new Date().toISOString()
    patchParticipant(p.id, { checked_in_at: optimisticTime }) // 먼저 화면부터 바꿈
    setFlashId(p.id)
    setTimeout(() => setFlashId(null), 1300)

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
  const handleSearchKeyDown = (e) => {
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
    <div className="min-h-dvh pb-24">
      {/* 상단 고정 바 --------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <h1 className="truncate text-lg font-bold text-slate-900">접수처</h1>
            </div>
            <p className="mt-0.5 text-[14px] text-slate-500">
              전체 <b className="text-slate-700">{roster.length.toLocaleString()}</b>명 중{' '}
              <b className="text-emerald-600">{totalDone.toLocaleString()}</b>명 접수
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <IconButton title="명단 갱신" onClick={() => refreshRoster()} busy={rosterLoading}>
              🔄
            </IconButton>
            <IconButton title="명단 관리" onClick={onOpenManage}>
              ⚙️
            </IconButton>
            <button
              onClick={onLogout}
              className="h-11 rounded-xl px-3 text-[15px] font-semibold text-slate-500
                         transition hover:bg-slate-100 active:scale-95"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {/* 검색 -------------------------------------------------------- */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="이름"
                autoComplete="off"
                spellCheck={false}
                className="pr-11"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-200 p-1.5
                             text-slate-500 transition hover:bg-slate-300"
                  aria-label="지우기"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="w-24 shrink-0">
              <Input
                value={lcFilter}
                onChange={(e) => setLcFilter(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="LC"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* 검색 결과 ---------------------------------------------------- */}
        <div className="mt-4">
          {results === null ? (
            <EmptyState icon="🔍" title="이름을 입력해주세요" />
          ) : results.length === 0 ? (
            <EmptyState
              icon="🤔"
              title="검색 결과가 없습니다"
              description="명단에 없는 참가자라면 아래 '현장 등록' 을 이용해주세요"
            />
          ) : (
            <>
              <div className="mb-2 px-1 text-xs font-semibold text-slate-500">
                {results.length}명
                {results.length === MAX_RESULTS && ' (일부만 표시)'}
              </div>
              <div className="space-y-2">
                {results.map((p) => (
                  <ResultCard
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

      {/* 하단 고정 버튼 ------------------------------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-3 py-2.5">
          <NavButton icon="➕" label="현장 등록" accent onClick={() => setModal('walkin')} />
          <NavButton icon="📋" label="미접수자" onClick={() => setModal('pending')} />
          <NavButton icon="📊" label="통계" onClick={() => setModal('stats')} />
        </div>
      </nav>

      {/* 모달들 -------------------------------------------------------- */}
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
function ResultCard({ p, lcPerDay, busy, flash, onCheckIn, onUndo }) {
  const done = Boolean(p.checked_in_at)
  const day = dayOfLc(p.lc, lcPerDay)

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 transition
                  ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}
                  ${flash ? 'flash-success' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xl font-bold text-slate-900">{p.name}</span>
          <Badge color="blue">{lcLabel(p.lc)}</Badge>
          {day && <Badge color="slate">{day}일차</Badge>}
          {p.is_walkin && <Badge color="amber">현장</Badge>}
        </div>

        <div className="mt-1.5 space-y-0.5">
          {p.dept && <div className="text-[15px] text-slate-500">{p.dept}</div>}
          {p.phone && (
            <div className="text-[16px] font-semibold tabular-nums text-slate-700">
              {formatPhone(p.phone)}
            </div>
          )}
          {p.student_id && (
            <div className="text-[14px] tabular-nums text-slate-500">학번 {p.student_id}</div>
          )}
        </div>

        {done && (
          <div className="mt-1.5 text-[14px] font-semibold text-emerald-600">
            ✓ {timeOnly(p.checked_in_at)} 접수
          </div>
        )}
      </div>

      <div className="shrink-0">
        {done ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            loading={busy}
            className="text-red-600 hover:bg-red-50"
          >
            취소
          </Button>
        ) : (
          <Button variant="green" size="md" onClick={onCheckIn} loading={busy} className="min-w-[88px]">
            접수
          </Button>
        )}
      </div>
    </div>
  )
}

/** 하단 고정 버튼 — 좁은 폰에서도 글자가 안 잘리도록 세로로 배치했습니다 */
function NavButton({ icon, label, onClick, accent = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl font-bold
                  transition active:scale-[0.97]
                  ${accent
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[13px] leading-none">{label}</span>
    </button>
  )
}

function IconButton({ children, title, onClick, busy }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={busy}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-lg
                 transition hover:bg-slate-100 active:scale-95 disabled:opacity-50"
    >
      {busy ? <Spinner className="h-5 w-5 text-slate-400" /> : children}
    </button>
  )
}
