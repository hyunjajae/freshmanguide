// 진행 FG 화면 (조회 전용)
// ------------------------------------------------------------------
// FG는 폰으로 볼 확률이 100%라 모바일 기준으로 크게 만들었습니다.
// 로그인 → 일차 선택 → 명단 순서로 진행하고, 명단에서 일차 선택으로 돌아갈 수 있습니다.
// 접수처에서 [접수] 를 누르면 실시간 방송을 받아 즉시 반영됩니다.

import { useMemo, useState } from 'react'
import { lcLabel, dayOfLc, lcRangeOfDay, timeOnly, timeAgo, percent, formatPhone } from '../lib/format'
import { Badge, EmptyState, ProgressBar, Spinner } from '../components/UI'
import { useWakeLock } from '../hooks/useWakeLock'
import StatsModal from './StatsModal'

export default function FgScreen({
  session,
  settings,
  roster,
  rosterLoading,
  refreshRoster,
  onLogout,
  onError,
}) {
  useWakeLock(true) // 명단을 보는 동안 화면이 꺼지지 않도록

  const lcPerDay = settings.lc_per_day || 31
  const totalDays = settings.total_days || 3

  const myLcs = useMemo(() => [...(session.lcs || [])].sort((a, b) => a - b), [session.lcs])

  const [day, setDay] = useState(null) // 항상 일차를 고르고 들어갑니다
  const [showStats, setShowStats] = useState(false)

  // 일차별로 내가 담당하는 LC 목록을 미리 계산
  const lcsByDay = useMemo(() => {
    const map = {}
    for (let d = 1; d <= totalDays; d++) {
      const [min, max] = lcRangeOfDay(d, lcPerDay)
      map[d] = myLcs.filter((lc) => lc >= min && lc <= max)
    }
    return map
  }, [myLcs, lcPerDay, totalDays])

  // ── 담당 LC가 아예 없는 경우 ──────────────────────────────────────
  if (myLcs.length === 0) {
    return (
      <Shell name={session.name} onLogout={onLogout}>
        <EmptyState
          icon="🙋"
          title="담당 LC가 등록되지 않았습니다"
          description="접수처에 문의해 담당 LC를 등록해주세요."
        />
      </Shell>
    )
  }

  // ── 1단계: 일차 선택 ─────────────────────────────────────────────
  if (day === null) {
    return (
      <Shell name={session.name} onLogout={onLogout}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h2 className="mb-1 text-center text-2xl font-bold text-slate-900">날짜 선택</h2>
          <p className="mb-7 text-center text-[15px] text-slate-500">
            확인할 날짜를 선택해주세요
          </p>

          <div className="space-y-3">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
              const lcs = lcsByDay[d]
              const has = lcs.length > 0
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={`flex w-full items-center gap-4 rounded-2xl p-5 text-left shadow-sm
                              ring-1 transition active:scale-[0.99]
                              ${has
                                ? 'bg-white ring-slate-900/5 hover:shadow-md'
                                : 'bg-slate-50 ring-slate-200'}`}
                >
                  <div
                    className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl
                                ${has ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                  >
                    <span className="text-2xl font-bold leading-none">{d}</span>
                    <span className="mt-0.5 text-[11px] font-semibold opacity-80">일차</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    {has ? (
                      <>
                        <div className="text-[15px] font-bold text-slate-900">
                          담당 {lcs.length}개
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {lcs.map((lc) => (
                            <Badge key={lc} color="blue">
                              {lcLabel(lc)}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-[15px] font-semibold text-slate-400">
                        담당 LC가 없습니다
                      </div>
                    )}
                  </div>

                  <svg
                    className="h-6 w-6 shrink-0 text-slate-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
      </Shell>
    )
  }

  // ── 2단계: 명단 ──────────────────────────────────────────────────
  const [minLc, maxLc] = lcRangeOfDay(day, lcPerDay)
  const dayLcs = lcsByDay[day]

  const list = roster.filter((p) => p.lc >= minLc && p.lc <= maxLc)
  const doneList = list
    .filter((p) => p.checked_in_at)
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at)) // 최근 접수가 위로
  const waitList = list
    .filter((p) => !p.checked_in_at)
    .sort((a, b) => a.lc - b.lc || a.name.localeCompare(b.name, 'ko'))

  const pct = percent(doneList.length, list.length)

  return (
    <Shell name={session.name} onLogout={onLogout} onBack={() => setDay(null)}>
      {/* 내 담당 요약 ------------------------------------------------- */}
      <div className="border-b border-slate-200 bg-white px-4 pb-5 pt-2">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 text-xl font-bold text-slate-900">{day}일차</div>
              <div className="flex flex-wrap gap-1">
                {dayLcs.length === 0 ? (
                  <Badge color="red">담당 LC 없음</Badge>
                ) : (
                  dayLcs.map((lc) => (
                    <Badge key={lc} color="blue">
                      {lcLabel(lc)}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <RoundButton label="새로고침" onClick={() => refreshRoster()} busy={rosterLoading}>
                🔄
              </RoundButton>
              <RoundButton label="전체 통계" onClick={() => setShowStats(true)}>
                📊
              </RoundButton>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-slate-600">진행률</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {doneList.length} / {list.length}
                <span className="ml-2 text-emerald-600">{pct}%</span>
              </span>
            </div>
            <ProgressBar value={pct} className="h-2.5" />
          </div>
        </div>
      </div>

      {/* 명단 ---------------------------------------------------------- */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        {rosterLoading && list.length === 0 ? (
          <div className="flex justify-center py-16 text-slate-300">
            <Spinner className="h-8 w-8" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="📭"
            title="해당 일차에 배정된 인원이 없습니다"
            description="담당 LC를 다시 확인하거나 다른 날짜를 선택해주세요."
          />
        ) : (
          <div className="space-y-5">
            {waitList.length > 0 && (
              <Section title="미접수" count={waitList.length} tone="amber">
                {waitList.map((p) => (
                  <PersonRow key={p.id} p={p} />
                ))}
              </Section>
            )}

            {doneList.length > 0 && (
              <Section title="접수 완료" count={doneList.length} tone="green">
                {doneList.map((p) => (
                  <PersonRow key={p.id} p={p} done />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      <StatsModal
        open={showStats}
        onClose={() => setShowStats(false)}
        session={session}
        settings={settings}
        onError={onError}
      />
    </Shell>
  )
}

/** 상단 바 (뒤로가기 버튼은 명단 화면에서만 나옵니다) */
function Shell({ name, onLogout, onBack, children }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-1">
            {onBack && (
              <button
                onClick={onBack}
                className="-ml-1 flex h-11 shrink-0 items-center gap-0.5 rounded-xl pl-1 pr-2
                           text-[15px] font-semibold text-slate-500 transition
                           hover:bg-slate-100 hover:text-slate-900 active:scale-95"
              >
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                날짜
              </button>
            )}
            <h1 className="truncate text-lg font-bold text-slate-900">
              <span className="text-blue-600">{name}</span> FG님
            </h1>
          </div>

          <button
            onClick={onLogout}
            className="h-11 shrink-0 rounded-xl px-3 text-[15px] font-semibold text-slate-500
                       transition hover:bg-slate-100 active:scale-95"
          >
            로그아웃
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}

/** 접수 완료 / 미접수 그룹 */
function Section({ title, count, tone, children }) {
  const tones = {
    green: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
  }
  return (
    <section>
      <div
        className={`mb-2 flex items-center justify-between rounded-xl border px-4 py-2.5 ${tones[tone]}`}
      >
        <span className="text-base font-bold">{title}</span>
        <span className="text-base font-bold tabular-nums">{count}명</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        {children}
      </div>
    </section>
  )
}

/** 참가자 한 줄 — 연락처와 학번을 전부 보여줍니다 */
function PersonRow({ p, done = false }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-3.5 py-3.5 last:border-b-0">
      <div
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl
                    ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
      >
        <span className="text-[10px] font-bold opacity-60">LC</span>
        <span className="text-lg font-bold leading-tight">{String(p.lc).padStart(2, '0')}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-lg font-bold text-slate-900">{p.name}</span>
          {p.dept && <span className="text-[14px] text-slate-500">{p.dept}</span>}
          {p.is_walkin && <Badge color="amber">현장</Badge>}
        </div>

        <div className="mt-1 space-y-0.5">
          {p.phone && (
            <div className="text-[15px] font-semibold tabular-nums text-slate-700">
              {formatPhone(p.phone)}
            </div>
          )}
          {p.student_id && (
            <div className="text-[14px] tabular-nums text-slate-500">학번 {p.student_id}</div>
          )}
        </div>
      </div>

      <div className="shrink-0 pt-0.5 text-right">
        {done ? (
          <>
            <div className="text-xl font-bold leading-none text-emerald-600">✓</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-slate-500">
              {timeOnly(p.checked_in_at)}
            </div>
            <div className="text-[12px] text-slate-400">{timeAgo(p.checked_in_at)}</div>
          </>
        ) : (
          <span className="text-[15px] font-bold text-slate-400">대기</span>
        )}
      </div>
    </div>
  )
}

function RoundButton({ children, label, onClick, busy }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={busy}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-lg transition
                 hover:bg-slate-100 active:scale-95 disabled:opacity-50"
    >
      {busy ? <Spinner className="h-5 w-5 text-slate-400" /> : children}
    </button>
  )
}
