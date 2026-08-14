// 관리 화면 — 명단 업로드 / 계정 / 설정

import { useState } from 'react'
import * as api from '../lib/api'
import { Button, Icon, Input } from '../components/UI'
import ParticipantUpload from './ParticipantUpload'
import AccountsPanel from './AccountsPanel'
import RosterExport from './RosterExport'

const TABS = [
  { id: 'participants', label: '참가자 명단' },
  { id: 'accounts', label: '계정' },
  { id: 'settings', label: '설정' },
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
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner" style={{ paddingBottom: 0, flexWrap: 'wrap' }}>
          <div className="topbar__left" style={{ width: '100%', paddingBottom: 10 }}>
            <button className="back-btn" onClick={onBack}>
              <Icon.chevronLeft />
              접수 화면
            </button>
            <div className="brand">
              <span className="brand__eyebrow">Manage</span>
              <span className="brand__name">명단 관리</span>
            </div>
          </div>

          <nav className="tabs" style={{ width: '100%', border: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? 'is-on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
        {tab === 'participants' && (
          <div className="stack" style={{ gap: 20 }}>
            <div className="panel row" style={{ justifyContent: 'space-between' }}>
              <span className="section-head__title">현재 등록된 참가자</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.03em' }}>
                {roster.length.toLocaleString()}
                <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>명</span>
              </span>
            </div>

            <RosterExport roster={roster} settings={settings} showToast={showToast} />

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
    <form onSubmit={save} className="stack" style={{ gap: 18 }}>
      <p className="note note--info">
        여기서 바꾼 값은 코드 수정 없이 바로 적용됩니다. 내년에 LC 개수가 달라져도 이 화면에서
        조정하세요.
      </p>

      <div className="card">
        <div className="card__body stack" style={{ gap: 18 }}>
          <Input
            label="행사 이름"
            value={form.event_name}
            onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
            placeholder="2026 팀빌딩 접수"
          />

          <div className="grid-2">
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

          <div className="panel" style={{ backgroundColor: 'var(--surface-2)', border: 0 }}>
            <div className="section-head__title" style={{ marginBottom: 8 }}>
              이렇게 나뉩니다
            </div>
            <div className="stack-s">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <div key={d} className="num" style={{ fontSize: 14, color: 'var(--text-soft)' }}>
                  {d}일차 · LC {(d - 1) * lcPerDay + 1} ~ {d * lcPerDay}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
              전체 LC {lcPerDay * totalDays}개
            </div>
          </div>

          <Button type="submit" variant="solid" block loading={saving}>
            저장
          </Button>
        </div>
      </div>
    </form>
  )
}
