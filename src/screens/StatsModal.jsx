// 실시간 통계
// 개인정보 없이 LC별 인원/접수 수만 서버에서 받아옵니다 (FG도 볼 수 있음).

import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { lcLabel, dayOfLc, percent } from '../lib/format'
import { Modal, ProgressBar, Spinner } from '../components/UI'

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
      byDay.reduce(
        (acc, d) => ({ total: acc.total + d.total, done: acc.done + d.done }),
        { total: 0, done: 0 }
      ),
    [byDay]
  )

  return (
    <Modal open={open} onClose={onClose} title="📊 실시간 통계" wide>
      {loading && !rows ? (
        <div className="flex justify-center py-16 text-slate-300">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">아직 명단이 없습니다.</p>
      ) : (
        <div className="space-y-5">
          {/* 전체 요약 -------------------------------------------------- */}
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <div className="flex items-end justify-between">
              <span className="text-sm font-semibold text-slate-300">전체 접수율</span>
              <span className="text-3xl font-bold tabular-nums">
                {percent(grand.done, grand.total)}
                <span className="text-lg">%</span>
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${percent(grand.done, grand.total)}%` }}
              />
            </div>
            <div className="mt-2 text-sm tabular-nums text-slate-300">
              {grand.done.toLocaleString()} / {grand.total.toLocaleString()}명
            </div>
          </div>

          {/* 일차별 ----------------------------------------------------- */}
          {byDay.map((d) => {
            const p = percent(d.done, d.total)
            return (
              <div key={d.day} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-bold text-slate-900">{d.day}일차</span>
                  <span className="text-sm font-bold tabular-nums text-slate-600">
                    {d.done} / {d.total}
                    <span className="ml-1.5 text-emerald-600">{p}%</span>
                  </span>
                </div>

                <ProgressBar value={p} className="mb-3" />

                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                  {d.lcs.map((r) => {
                    const lp = percent(r.done, r.total)
                    const complete = lp >= 100
                    return (
                      <div
                        key={r.lc}
                        className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold tabular-nums
                                    ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                        title={`${lcLabel(r.lc)} · ${lp}%`}
                      >
                        <div className="text-[10px] opacity-60">{lcLabel(r.lc)}</div>
                        <div>
                          {r.done}/{r.total}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {updatedAt && (
            <p className="text-center text-xs text-slate-400">
              {updatedAt.toLocaleTimeString('ko-KR', { hour12: false })} 기준 · 15초마다 자동 갱신
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
