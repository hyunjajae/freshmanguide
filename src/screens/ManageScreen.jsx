// 관리 화면 — 명단 업로드 / 계정 / 설정

import { useState } from 'react'
import * as api from '../lib/api'
import { Button, Input } from '../components/UI'
import ParticipantUpload from './ParticipantUpload'
import AccountsPanel from './AccountsPanel'

const TABS = [
  { id: 'participants', label: '참가자 명단', icon: '📋' },
  { id: 'accounts', label: '계정', icon: '👥' },
  { id: 'settings', label: '설정', icon: '⚙️' },
]

export default function ManageScreen({
  session,
  settings,
  roster,
  refreshRoster,
  onBack,
  onError,
  showToast,
}) {
  const [tab, setTab] = useState('participants')

  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex items-center justify-between py-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-semibold
                         text-slate-500 transition hover:text-slate-900"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              접수 화면으로
            </button>
            <h1 className="font-bold text-slate-900">명단 관리</h1>
          </div>

          <div className="flex gap-1 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {tab === 'participants' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-600">현재 등록된 참가자</span>
                <span className="text-2xl font-bold tabular-nums text-slate-900">
                  {roster.length.toLocaleString()}
                  <span className="ml-1 text-sm font-semibold text-slate-400">명</span>
                </span>
              </div>
            </div>

            <ParticipantUpload
              session={session}
              settings={settings}
              currentCount={roster.length}
              onDone={refreshRoster}
              onError={onError}
              showToast={showToast}
            />
          </div>
        )}

        {tab === 'accounts' && (
          <AccountsPanel
            session={session}
            settings={settings}
            onError={onError}
            showToast={showToast}
          />
        )}

        {tab === 'settings' && (
          <SettingsPanel
            session={session}
            settings={settings}
            onError={onError}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  )
}

// ── 설정 ─────────────────────────────────────────────────────────────
function SettingsPanel({ session, settings, onError, showToast }) {
  const [form, setForm] = useState({
    event_name: settings.event_name || '',
    lc_per_day: String(settings.lc_per_day || 31),
    total_days: String(settings.total_days || 3),
  })
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await Promise.all([
        api.setSetting(session.token, 'event_name', form.event_name.trim()),
        api.setSetting(session.token, 'lc_per_day', String(parseInt(form.lc_per_day, 10) || 31)),
        api.setSetting(session.token, 'total_days', String(parseInt(form.total_days, 10) || 3)),
      ])
      showToast('저장했습니다. 새로고침하면 반영됩니다.', 'success')
    } catch (err) {
      onError(err, '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const lcPerDay = parseInt(form.lc_per_day, 10) || 31
  const totalDays = parseInt(form.total_days, 10) || 3

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
        여기서 바꾼 값은 코드 수정 없이 바로 적용됩니다. 내년에 LC 개수가 달라져도 이 화면에서 조정하세요.
      </div>

      <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-900/5">
        <Input
          label="행사 이름"
          value={form.event_name}
          onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
          placeholder="2026 팀빌딩 접수"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="하루 LC 개수"
            value={form.lc_per_day}
            onChange={(e) => setForm((f) => ({ ...f, lc_per_day: e.target.value }))}
            inputMode="numeric"
          />
          <Input
            label="총 일수"
            value={form.total_days}
            onChange={(e) => setForm((f) => ({ ...f, total_days: e.target.value }))}
            inputMode="numeric"
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-3.5 text-sm">
          <p className="mb-1.5 font-bold text-slate-700">이렇게 나뉩니다</p>
          <ul className="space-y-0.5 text-slate-600">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
              <li key={d} className="tabular-nums">
                {d}일차 · LC {(d - 1) * lcPerDay + 1} ~ {d * lcPerDay}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            전체 LC {lcPerDay * totalDays}개
          </p>
        </div>

        <Button type="submit" loading={saving} className="w-full">
          저장
        </Button>
      </div>
    </form>
  )
}
