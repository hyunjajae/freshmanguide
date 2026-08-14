// 실시간 통계
// 개인정보 없이 LC별 인원/접수 수만 서버에서 받아옵니다 (FG도 볼 수 있음).

import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { lcLabel, dayOfLc, percent } from '../lib/format'
import { Meter, Modal, Spinner } from '../components/UI'

const REFRESH_MS = 15_000 // 통계 창이 떠 있는 동안만 15초마다 갱신

export default function StatsModal({ open, onClose, session, settings, onError }) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  const lcPerDay = settings.lc_per_day || 31

  useEffect(() => {
    if (!open) return
    let alive = true

    const load = async (showSpinner) => {
      if (showSpinner) setLoading(true)
      try {
        const data = await api.getStats(session.token)
        if (alive) {
          setRows(Array.isArray(data) ? data : [])
          setUpdatedAt(new Date())
        }
      } catch (err) {
        if (alive && showSpinner) onError(err, '통계를 불러오지 못했습니다.')
      } finally {
        if (alive && showSpinner) setLoading(false)
      }
    }

    load(true)
    const timer = setInterval(() => load(false), REFRESH_MS)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [open, session.token, onError])

  // LC별 데이터를 일차별로 묶습니다
  const byDay = useMemo(() => {
    if (!rows) return []
    const map = new Map()

    for (const r of rows) {
      const d = dayOfLc(r.lc, lcPerDay)
      if (!d) continue
      if (!map.has(d)) map.set(d, { day: d, total: 0, done: 0, lcs: [] })
      const bucket = map.get(d)
      bucket.total += r.total
      bucket.done += r.done
      bucket.lcs.push(r)
    }

    return [...map.values()].sort((a, b) => a.day - b.day)
  }, [rows, lcPerDay])

  const grand = useMemo(
    () =>
      byDay.reduce((acc, d) => ({ total: acc.total + d.total, done: acc.done + d.done }), {
        total: 0,
        done: 0,
      }),
    [byDay]
  )

  return (
    <Modal open={open} onClose={onClose} title="실시간 통계" wide>
      {loading && !rows ? (
        <div className="loading">
          <Spinner size={26} />
        </div>
      ) : !rows || rows.length === 0 ? (
        <p style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          아직 명단이 없습니다.
        </p>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {/* 전체 요약 -------------------------------------------------- */}
          <div className="stat-hero">
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}
            >
              <span className="stat-hero__label">전체 접수율</span>
              <span className="stat-hero__value">
                {percent(grand.done, grand.total)}
                <small>%</small>
              </span>
            </div>
            <div style={{ marginTop: 14 }}>
              <Meter value={percent(grand.done, grand.total)} onDark />
            </div>
            <div className="stat-hero__count">
              {grand.done.toLocaleString()} / {grand.total.toLocaleString()}명
            </div>
          </div>

          {/* 일차별 ----------------------------------------------------- */}
          {byDay.map((d) => {
            const p = percent(d.done, d.total)
            return (
              <div key={d.day} className="panel">
                <div
                  className="row"
                  style={{ justifyContent: 'space-between', alignItems: 'baseline' }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
                    {d.day}일차
                  </span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-soft)' }}>
                    {d.done} / {d.total}
                    <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{p}%</span>
                  </span>
                </div>

                <div style={{ margin: '12px 0 16px' }}>
                  <Meter value={p} />
                </div>

                <div className="lc-grid">
                  {d.lcs.map((r) => {
                    const lp = percent(r.done, r.total)
                    return (
                      <div
                        key={r.lc}
                        className={`lc-cell ${lp >= 100 ? 'is-full' : ''}`}
                        title={`${lcLabel(r.lc)} · ${lp}%`}
                      >
                        <i>{lcLabel(r.lc)}</i>
                        <b>
                          {r.done}/{r.total}
                        </b>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {updatedAt && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
              {updatedAt.toLocaleTimeString('ko-KR', { hour12: false })} 기준 · 15초마다 자동 갱신
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
