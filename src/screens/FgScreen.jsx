// 진행 FG 화면 (조회 전용)
// ------------------------------------------------------------------
// FG는 폰으로 볼 확률이 100%라 모바일 기준으로 만들었습니다.
// 로그인 → 일차 선택 → 명단 순서로 진행하고, 명단에서 일차 선택으로 돌아갈 수 있습니다.
// 접수처에서 [접수] 를 누르면 실시간 방송을 받아 즉시 반영됩니다.

import { useMemo, useState } from 'react'
import { lcLabel, lcRangeOfDay, timeOnly, timeAgo, percent, formatPhone } from '../lib/format'
import { Empty, Icon, Meter, Spinner, Tag } from '../components/UI'
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
        <div className="wrap">
          <Empty
            icon="user"
            title="담당 LC가 등록되지 않았습니다"
            desc="접수처에 문의해 담당 LC를 등록해주세요."
          />
        </div>
      </Shell>
    )
  }

  // ── 1단계: 일차 선택 ─────────────────────────────────────────────
  if (day === null) {
    return (
      <Shell name={session.name} onLogout={onLogout}>
        <div className="wrap rise">
          <header className="page-head">
            <p className="eyebrow">Select day</p>
            <h1 className="title title--sm">날짜 선택</h1>
          </header>

          <div className="stack" style={{ paddingBottom: 40 }}>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
              const lcs = lcsByDay[d]
              const has = lcs.length > 0
              return (
                <button
                  key={d}
                  className={`day-card ${has ? '' : 'is-empty'}`}
                  onClick={() => setDay(d)}
                >
                  <span className="day-card__num">
                    <b>{d}</b>
                    <i>일차</i>
                  </span>

                  <span className="day-card__main">
                    <span className="day-card__label">
                      {has ? `담당 ${lcs.length}개` : '담당 없음'}
                    </span>
                    <span className="day-card__lcs">
                      {has ? (
                        lcs.map((lc) => <Tag key={lc} tone="accent">{lcLabel(lc)}</Tag>)
                      ) : (
                        <Tag tone="line">이 날짜에는 담당 LC가 없습니다</Tag>
                      )}
                    </span>
                  </span>

                  <span className="role-card__arrow">
                    <Icon.chevronRight />
                  </span>
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
      {/* 담당 요약 ---------------------------------------------------- */}
      <div className="wrap" style={{ paddingTop: 18 }}>
        <div className="panel">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="day-card__label">{day}일차 담당</div>
              <div className="day-card__lcs" style={{ marginTop: 7 }}>
                {dayLcs.length === 0 ? (
                  <Tag tone="bad">담당 LC 없음</Tag>
                ) : (
                  dayLcs.map((lc) => <Tag key={lc} tone="accent">{lcLabel(lc)}</Tag>)
                )}
              </div>
            </div>

            <div className="row-end" style={{ gap: 6 }}>
              <button
                className="icon-btn"
                onClick={() => refreshRoster()}
                disabled={rosterLoading}
                aria-label="새로고침"
              >
                {rosterLoading ? <Spinner size={15} /> : <Icon.refresh />}
              </button>
              <button
                className="icon-btn"
                onClick={() => setShowStats(true)}
                aria-label="전체 통계"
              >
                <Icon.chart />
              </button>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}
            >
              <span className="section-head__title">진행률</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
                {doneList.length} / {list.length}
                <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{pct}%</span>
              </span>
            </div>
            <Meter value={pct} />
          </div>
        </div>
      </div>

      {/* 명단 ---------------------------------------------------------- */}
      <div className="wrap" style={{ paddingTop: 22, paddingBottom: 44 }}>
        {rosterLoading && list.length === 0 ? (
          <div className="loading">
            <Spinner size={26} />
          </div>
        ) : list.length === 0 ? (
          <Empty
            title="배정된 인원이 없습니다"
            desc="담당 LC를 다시 확인하거나 다른 날짜를 선택해주세요."
          />
        ) : (
          <div className="stack" style={{ gap: 26 }}>
            {waitList.length > 0 && (
              <section>
                <div className="section-head">
                  <span className="section-head__title section-head__title--wait">미접수</span>
                  <span className="section-head__count">{waitList.length}명</span>
                </div>
                <div className="list">
                  {waitList.map((p) => (
                    <RosterRow key={p.id} p={p} />
                  ))}
                </div>
              </section>
            )}

            {doneList.length > 0 && (
              <section>
                <div className="section-head">
                  <span className="section-head__title section-head__title--done">접수 완료</span>
                  <span className="section-head__count">{doneList.length}명</span>
                </div>
                <div className="list">
                  {doneList.map((p) => (
                    <RosterRow key={p.id} p={p} done />
                  ))}
                </div>
              </section>
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
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__left">
            {onBack && (
              <button className="back-btn" onClick={onBack}>
                <Icon.chevronLeft />
                날짜
              </button>
            )}
            {!onBack && <img className="topbar__logo" src="/logo.png" alt="" />}
            <div className="brand">
              <span className="brand__eyebrow">Freshman Guide</span>
              <span className="brand__name">
                <em>{name}</em> FG님
              </span>
            </div>
          </div>

          <div className="topbar__right">
            <button className="btn btn--quiet btn--sm" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

/** 참가자 한 줄 — 연락처와 학번을 전부 보여줍니다 */
function RosterRow({ p, done = false }) {
  return (
    <div className="roster-row">
      <span className={`lc-badge ${done ? 'lc-badge--done' : ''}`}>
        <i>LC</i>
        <b>{String(p.lc).padStart(2, '0')}</b>
      </span>

      <div className="roster-row__main">
        <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
          <span className="roster-row__name">{p.name}</span>
          {p.dept && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.dept}</span>}
          {p.is_walkin && <Tag tone="warn">현장</Tag>}
        </div>

        {p.phone && (
          <div className="roster-row__meta">
            <i>연락처</i>
            {formatPhone(p.phone)}
          </div>
        )}
      </div>

      <div className="roster-row__right">
        {done ? (
          <>
            <div className="roster-row__tick">
              <Icon.check style={{ width: 15, height: 15 }} />
            </div>
            <div className="roster-row__time">{timeOnly(p.checked_in_at)}</div>
            <div className="roster-row__ago">{timeAgo(p.checked_in_at)}</div>
          </>
        ) : (
          <span className="roster-row__wait">대기</span>
        )}
      </div>
    </div>
  )
}
