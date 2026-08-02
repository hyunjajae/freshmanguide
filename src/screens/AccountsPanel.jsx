// 계정 관리
//   · FG 계정 + 담당 LC 를 표로 한 번에 업로드
//   · 접수처(관리자) 계정 추가/삭제/비밀번호 변경

import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { parseTable, looksLikeHeader } from '../lib/csv'
import { lcLabel } from '../lib/format'
import { Badge, Button, EmptyState, Input, Spinner } from '../components/UI'

export default function AccountsPanel({ session, settings, onError, showToast }) {
  const [accounts, setAccounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('list') // 'list' | 'upload'

  const maxLc = (settings.lc_per_day || 31) * (settings.total_days || 3)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.listAccounts(session.token)
      setAccounts(Array.isArray(data) ? data : [])
    } catch (err) {
      onError(err, '계정 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const admins = useMemo(() => (accounts || []).filter((a) => a.role === 'ADMIN'), [accounts])
  const fgs = useMemo(() => (accounts || []).filter((a) => a.role === 'FG'), [accounts])

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-300">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        <TabChip active={tab === 'list'} onClick={() => setTab('list')}>
          계정 목록
        </TabChip>
        <TabChip active={tab === 'upload'} onClick={() => setTab('upload')}>
          FG 일괄 등록
        </TabChip>
      </div>

      {tab === 'list' ? (
        <AccountList
          session={session}
          admins={admins}
          fgs={fgs}
          maxLc={maxLc}
          onChanged={load}
          onError={onError}
          showToast={showToast}
        />
      ) : (
        <FgUpload
          session={session}
          maxLc={maxLc}
          onDone={() => {
            load()
            setTab('list')
          }}
          onError={onError}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ── 계정 목록 + 추가/삭제 ────────────────────────────────────────────
function AccountList({ session, admins, fgs, maxLc, onChanged, onError, showToast }) {
  const [form, setForm] = useState({ role: 'ADMIN', loginId: '', loginKey: '', lcs: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const filteredFgs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fgs
    return fgs.filter(
      (a) =>
        a.login_id.toLowerCase().includes(q) ||
        (a.lcs || []).some((lc) => String(lc) === q.replace(/[^0-9]/g, ''))
    )
  }, [fgs, search])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.loginId.trim() || !form.loginKey.trim()) {
      return showToast('아이디와 비밀번호를 모두 입력해주세요.', 'warn')
    }

    const lcs = form.lcs
      .split(/[,\s]+/)
      .map((s) => parseInt(s.replace(/[^0-9]/g, ''), 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= maxLc)

    setSaving(true)
    try {
      const res = await api.upsertAccount(session.token, {
        role: form.role,
        loginId: form.loginId.trim(),
        loginKey: form.loginKey.trim(),
        lcs: form.role === 'FG' ? lcs : [],
      })
      if (!res?.ok) return showToast(res?.message || '저장에 실패했습니다.', 'error')

      showToast(`${form.loginId} 계정을 저장했습니다.`, 'success')
      setForm({ role: form.role, loginId: '', loginKey: '', lcs: '' })
      onChanged()
    } catch (err) {
      onError(err, '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (acc) => {
    if (!window.confirm(`${acc.login_id} 계정을 삭제하시겠습니까?`)) return
    try {
      const res = await api.deleteAccount(session.token, acc.id)
      if (!res?.ok) return showToast(res?.message || '삭제에 실패했습니다.', 'error')
      showToast('계정을 삭제했습니다.', 'info')
      onChanged()
    } catch (err) {
      onError(err, '삭제에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 추가 / 수정 폼 -------------------------------------------------- */}
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-bold text-slate-800">계정 추가 / 비밀번호 변경</h4>

        <div className="mb-3 flex gap-1.5">
          {['ADMIN', 'FG'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r }))}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                form.role === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {r === 'ADMIN' ? '접수처' : '진행 FG'}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={form.role === 'ADMIN' ? '아이디' : '성함'}
            value={form.loginId}
            onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))}
            autoComplete="off"
            className="!py-2.5 !text-sm"
          />
          <Input
            label={form.role === 'ADMIN' ? '비밀번호' : '학번'}
            value={form.loginKey}
            onChange={(e) => setForm((f) => ({ ...f, loginKey: e.target.value }))}
            autoComplete="off"
            className="!py-2.5 !text-sm"
          />
        </div>

        {form.role === 'FG' && (
          <div className="mt-3">
            <Input
              label="담당 LC"
              value={form.lcs}
              onChange={(e) => setForm((f) => ({ ...f, lcs: e.target.value }))}
              placeholder="1, 2, 3"
              hint={`쉼표나 띄어쓰기로 구분해서 입력하세요 (1 ~ ${maxLc})`}
              className="!py-2.5 !text-sm"
            />
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          이미 있는 아이디를 입력하면 비밀번호와 담당 LC가 <b>덮어쓰기</b> 됩니다.
        </p>

        <Button type="submit" loading={saving} className="mt-3 w-full">
          저장
        </Button>
      </form>

      {/* 관리자 목록 ------------------------------------------------------ */}
      <section>
        <h4 className="mb-2 text-sm font-bold text-slate-800">접수처 계정 ({admins.length})</h4>
        <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
          {admins.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 last:border-b-0"
            >
              <span className="font-semibold text-slate-800">{a.login_id}</span>
              <button
                onClick={() => remove(a)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FG 목록 ---------------------------------------------------------- */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="shrink-0 text-sm font-bold text-slate-800">FG 계정 ({fgs.length})</h4>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 LC 검색"
            className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          />
        </div>

        {filteredFgs.length === 0 ? (
          <EmptyState icon="👥" title="등록된 FG 계정이 없습니다" description="'FG 일괄 등록' 탭에서 한 번에 넣을 수 있습니다" />
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-xl ring-1 ring-slate-200">
            {filteredFgs.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{a.login_id}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(a.lcs || []).length === 0 ? (
                      <Badge color="red">담당 LC 없음</Badge>
                    ) : (
                      [...a.lcs]
                        .sort((x, y) => x - y)
                        .map((lc) => (
                          <Badge key={lc} color="slate">
                            {lcLabel(lc)}
                          </Badge>
                        ))
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(a)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── FG 일괄 업로드 ───────────────────────────────────────────────────
function FgUpload({ session, maxLc, onDone, onError, showToast }) {
  const [raw, setRaw] = useState('')
  const [replace, setReplace] = useState(false)
  const [saving, setSaving] = useState(false)

  // 표를 읽어 { login_id, login_key, lcs[] } 형태로 변환
  const parsed = useMemo(() => {
    if (!raw.trim()) return null

    const table = parseTable(raw)
    if (table.length === 0) return null

    const rows = looksLikeHeaderFg(table[0]) ? table.slice(1) : table

    const items = []
    const errors = []

    rows.forEach((row, i) => {
      const name = String(row[0] ?? '').trim()
      const key = String(row[1] ?? '').trim()
      // 3번째 열부터 끝까지를 전부 LC 번호로 봅니다 (한 칸에 "1,2,3" 이어도 처리)
      const lcs = row
        .slice(2)
        .join(',')
        .split(/[,\s]+/)
        .map((s) => parseInt(String(s).replace(/[^0-9]/g, ''), 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= maxLc)

      if (!name || !key) {
        errors.push(`${i + 1}번째 줄: 이름 또는 학번이 비어 있음`)
        return
      }
      if (lcs.length === 0) {
        errors.push(`${i + 1}번째 줄 (${name}): 담당 LC 없음`)
      }

      items.push({ login_id: name, login_key: key, lcs: lcs.map(String) })
    })

    return { items, errors }
  }, [raw, maxLc])

  const upload = async () => {
    if (!parsed || parsed.items.length === 0) {
      return showToast('등록할 데이터가 없습니다.', 'warn')
    }
    if (replace && !window.confirm('기존 FG 계정을 모두 지우고 새로 등록합니다. 계속할까요?')) return

    setSaving(true)
    try {
      const res = await api.uploadFgAccounts(session.token, parsed.items, replace)
      if (!res?.ok) return showToast(res?.message || '등록에 실패했습니다.', 'error')
      showToast(`FG 계정 ${parsed.items.length}건을 등록했습니다.`, 'success')
      setRaw('')
      onDone()
    } catch (err) {
      onError(err, '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
        <b>성함 · 학번 · 담당 LC</b> 순서로 된 표를 붙여넣으세요. 담당 LC가 여러 개면 열을 나눠 쓰거나
        한 칸에 <code className="rounded bg-white/60 px-1">1,2,3</code> 처럼 적어도 됩니다.
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        placeholder={'성함\t학번\t담당LC\n홍길동\t20240001\t1,2\n김철수\t20240002\t3'}
        className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs
                   focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />

      {parsed && (
        <>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">
              {parsed.items.length}명 인식됨
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-amber-700">
                {parsed.errors.map((e, i) => (
                  <li key={i}>⚠️ {e}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl ring-1 ring-slate-200">
            {parsed.items.slice(0, 100).map((it, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-3.5 py-2 text-sm last:border-b-0"
              >
                <span className="font-semibold text-slate-800">{it.login_id}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {it.lcs.length === 0 ? (
                    <Badge color="red">LC 없음</Badge>
                  ) : (
                    it.lcs.map((lc) => (
                      <Badge key={lc} color="slate">
                        {lcLabel(lc)}
                      </Badge>
                    ))
                  )}
                </span>
              </div>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-red-50 px-4 py-3">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            <span className="text-sm font-semibold text-red-800">
              기존 FG 계정을 모두 지우고 새로 등록 (접수처 계정은 유지)
            </span>
          </label>

          <Button variant={replace ? 'red' : 'primary'} loading={saving} onClick={upload} className="w-full">
            {parsed.items.length}건 등록
          </Button>
        </>
      )}
    </div>
  )
}

/** FG 표의 첫 줄이 제목 줄인지 판단 */
function looksLikeHeaderFg(row) {
  const joined = row.join('').toLowerCase().replace(/\s/g, '')
  return ['성함', '이름', '학번', 'lc', '담당'].some((h) => joined.includes(h))
}

function TabChip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
