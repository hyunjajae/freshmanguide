// 미접수자 확인 — 마감 직전에 "누가 아직 안 왔지?" 를 확인하는 화면

import { useMemo, useState } from 'react'
import { lcLabel, lcRangeOfDay, formatPhone } from '../lib/format'
import { Badge, Button, EmptyState, Modal } from '../components/UI'

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

  // 선택 가능한 LC 목록
  // '전체' 일 때는 LC가 90개 넘게 쏟아져 오히려 보기 힘들어서, 일차를 고른 뒤에만 보여줍니다.
  const lcOptions = useMemo(
    () =>
      day === 'all'
        ? []
        : [...new Set(pendingByDay.map((p) => p.lc))].sort((a, b) => a - b),
    [pendingByDay, day]
  )

  const pending = useMemo(() => {
    const list = lc === 'all' ? pendingByDay : pendingByDay.filter((p) => p.lc === Number(lc))
    return list.sort((a, b) => a.lc - b.lc || a.name.localeCompare(b.name, 'ko'))
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

  const downloadCsv = () => {
    const header = '이름,LC,계열,학번,연락처\n'
    const body = pending
      .map((p) =>
        [p.name, lcLabel(p.lc), p.dept || '', p.student_id || '', formatPhone(p.phone) || '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙입니다
    const blob = new Blob(['﻿' + header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `미접수자_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV 파일을 내려받았습니다.', 'success')
  }

  return (
    <Modal open={open} onClose={onClose} title="📋 미접수자" wide>
      {/* 필터 ---------------------------------------------------------- */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={day === 'all'} onClick={() => { setDay('all'); setLc('all') }}>
            전체
          </FilterChip>
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
            <FilterChip
              key={d}
              active={day === String(d)}
              onClick={() => { setDay(String(d)); setLc('all') }}
            >
              {d}일차
            </FilterChip>
          ))}
        </div>

        {lcOptions.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip small active={lc === 'all'} onClick={() => setLc('all')}>
              LC 전체
            </FilterChip>
            {lcOptions.map((n) => (
              <FilterChip key={n} small active={lc === String(n)} onClick={() => setLc(String(n))}>
                {lcLabel(n)}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* 요약 + 내보내기 ------------------------------------------------ */}
      <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <span className="text-2xl font-bold tabular-nums text-slate-900">{pending.length}</span>
          <span className="ml-1 text-sm font-semibold text-slate-500">명 미접수</span>
        </div>
        {pending.length > 0 && (
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={copyList}>
              복사
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              CSV
            </Button>
          </div>
        )}
      </div>

      {/* 목록 ---------------------------------------------------------- */}
      {pending.length === 0 ? (
        <EmptyState icon="🎉" title="미접수자가 없습니다" description="전원 접수 완료되었습니다!" />
      ) : (
        <div className="space-y-3">
          {grouped.map(([lcNum, people]) => (
            <div key={lcNum} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2">
                <Badge color="blue">{lcLabel(lcNum)}</Badge>
                <span className="text-xs font-bold text-slate-500">{people.length}명</span>
              </div>
              <div className="divide-y divide-slate-100 bg-white">
                {people.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-400">
                      {p.dept}
                      {p.phone && <span className="ml-2 tabular-nums">{formatPhone(p.phone)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function FilterChip({ children, active, onClick, small = false }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg font-semibold transition ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
