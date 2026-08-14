// 계정 관리
//   · FG 계정 + 담당 LC 를 표로 한 번에 업로드
//   · 접수처(관리자) 계정 추가/삭제/비밀번호 변경

import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { parseTable } from '../lib/csv'
import { lcLabel } from '../lib/format'
import { josa } from '../lib/korean'
import { Button, Empty, Input, Spinner, Tag } from '../components/UI'

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

  const managers = useMemo(() => (accounts || []).filter((a) => a.role === 'MANAGER'), [accounts])
  const admins = useMemo(() => (accounts || []).filter((a) => a.role === 'ADMIN'), [accounts])
  const fgs = useMemo(() => (accounts || []).filter((a) => a.role === 'FG'), [accounts])

  if (loading) {
    return (
      <div className="loading">
        <Spinner size={26} />
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="chips">
        <button className={`chip ${tab === 'list' ? 'is-on' : ''}`} onClick={() => setTab('list')}>
          계정 목록
        </button>
        <button
          className={`chip ${tab === 'upload' ? 'is-on' : ''}`}
          onClick={() => setTab('upload')}
        >
          FG 일괄 등록
        </button>
      </div>

      {tab === 'list' ? (
        <AccountList
          session={session}
          managers={managers}
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

/** 비밀번호·학번을 보여주는 칩. 누르면 복사됩니다.
 *  운영자만 볼 수 있는 화면이라 가리지 않고 그대로 보여줍니다
 *  (FG에게 "네 학번이 로그인 비번이야" 라고 알려줘야 하는 일이 잦습니다) */
function Secret({ value, label, onCopy }) {
  if (!value) return <span className="secret secret--empty">{label} 없음</span>
  return (
    <button
      type="button"
      className="secret"
      title="눌러서 복사"
      onClick={() => onCopy(value, label)}
    >
      <i>{label}</i>
      <b>{value}</b>
    </button>
  )
}

// ── 계정 목록 + 추가/삭제 ────────────────────────────────────────────
function AccountList({ session, managers, admins, fgs, maxLc, onChanged, onError, showToast }) {
  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      showToast(`${josa(label, '을/를')} 복사했습니다.`, 'success')
    } catch {
      showToast('복사에 실패했습니다.', 'error')
    }
  }

  const [form, setForm] = useState({ role: 'ADMIN', loginId: '', loginKey: '', lcs: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const filteredFgs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fgs
    const digits = q.replace(/[^0-9]/g, '')
    return fgs.filter(
      (a) =>
        a.login_id.toLowerCase().includes(q) ||
        (digits && (a.lcs || []).some((lc) => String(lc) === digits))
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

  const isFg = form.role === 'FG'

  return (
    <div className="stack" style={{ gap: 26 }}>
      {/* 추가 / 수정 -------------------------------------------------- */}
      <form className="card" onSubmit={submit}>
        <div className="card__body stack" style={{ gap: 16 }}>
          <div className="section-head" style={{ margin: 0 }}>
            <span className="section-head__title">계정 추가 · 비밀번호 변경</span>
          </div>

          <div className="chips">
            {[
              ['MANAGER', '운영자'],
              ['ADMIN', '접수처'],
              ['FG', '진행 FG'],
            ].map(([r, label]) => (
              <button
                key={r}
                type="button"
                className={`chip ${form.role === r ? 'is-on' : ''}`}
                onClick={() => setForm((f) => ({ ...f, role: r }))}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid-2">
            <Input
              label={isFg ? '성함' : '아이디'}
              value={form.loginId}
              onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))}
              autoComplete="off"
            />
            <Input
              label={isFg ? '학번' : '비밀번호'}
              value={form.loginKey}
              onChange={(e) => setForm((f) => ({ ...f, loginKey: e.target.value }))}
              autoComplete="off"
              inputMode={isFg ? 'numeric' : 'text'}
            />
          </div>

          {isFg && (
            <Input
              label="담당 LC"
              value={form.lcs}
              onChange={(e) => setForm((f) => ({ ...f, lcs: e.target.value }))}
              placeholder="1, 2, 3"
              hint={`쉼표나 띄어쓰기로 구분해서 입력하세요 (1 ~ ${maxLc})`}
            />
          )}

          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            이미 있는 아이디를 입력하면 비밀번호와 담당 LC가 <b>덮어쓰기</b> 됩니다.
          </p>

          <Button type="submit" variant="solid" block loading={saving}>
            저장
          </Button>
        </div>
      </form>

      {/* 운영자 -------------------------------------------------------- */}
      <section>
        <div className="section-head">
          <span className="section-head__title">운영자 계정</span>
          <span className="section-head__count">{managers.length}</span>
        </div>
        <div className="list">
          {managers.map((a) => (
            <div key={a.id} className="list__row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{a.login_id}</div>
                <div style={{ marginTop: 5 }}>
                  <Secret value={a.login_key} label="비밀번호" onCopy={copyValue} />
                </div>
              </div>
              <Button variant="danger-quiet" size="sm" onClick={() => remove(a)}>
                삭제
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* 접수처 -------------------------------------------------------- */}
      <section>
        <div className="section-head">
          <span className="section-head__title">접수처 계정</span>
          <span className="section-head__count">{admins.length}</span>
        </div>
        <div className="list">
          {admins.map((a) => (
            <div key={a.id} className="list__row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{a.login_id}</div>
                <div style={{ marginTop: 5 }}>
                  <Secret value={a.login_key} label="비밀번호" onCopy={copyValue} />
                </div>
              </div>
              <Button variant="danger-quiet" size="sm" onClick={() => remove(a)}>
                삭제
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FG ------------------------------------------------------------ */}
      <section>
        <div className="section-head">
          <span className="section-head__title">FG 계정</span>
          <span className="section-head__count">{fgs.length}</span>
        </div>

        {fgs.length > 6 && (
          <input
            className="input"
            style={{ marginBottom: 10 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 LC 번호로 찾기"
            aria-label="FG 계정 검색"
          />
        )}

        {filteredFgs.length === 0 ? (
          <Empty
            icon="user"
            title={fgs.length === 0 ? '등록된 FG 계정이 없습니다' : '검색 결과가 없습니다'}
            desc={fgs.length === 0 ? 'FG 일괄 등록 탭에서 한 번에 넣을 수 있습니다.' : undefined}
          />
        ) : (
          <div className="list scroll-box--tall" style={{ overflowY: 'auto' }}>
            {filteredFgs.map((a) => (
              <div key={a.id} className="list__row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{a.login_id}</span>
                    <Secret value={a.login_key} label="학번" onCopy={copyValue} />
                  </div>
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {(a.lcs || []).length === 0 ? (
                      <Tag tone="bad">담당 LC 없음</Tag>
                    ) : (
                      [...a.lcs]
                        .sort((x, y) => x - y)
                        .map((lc) => (
                          <Tag key={lc} tone="accent">
                            {lcLabel(lc)}
                          </Tag>
                        ))
                    )}
                  </div>
                </div>
                <Button variant="danger-quiet" size="sm" onClick={() => remove(a)}>
                  삭제
                </Button>
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
      if (lcs.length === 0) errors.push(`${i + 1}번째 줄 (${name}): 담당 LC 없음`)

      items.push({ login_id: name, login_key: key, lcs: lcs.map(String) })
    })

    return { items, errors }
  }, [raw, maxLc])

  const upload = async () => {
    if (!parsed || parsed.items.length === 0) return showToast('등록할 데이터가 없습니다.', 'warn')
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
    <div className="stack" style={{ gap: 18 }}>
      <p className="note note--info">
        <b>성함 · 학번 · 담당 LC</b> 순서로 된 표를 붙여넣으세요. 담당 LC가 여러 개면 열을 나눠 쓰거나
        한 칸에 <span className="kbd">1,2,3</span> 처럼 적어도 됩니다.
      </p>

      <textarea
        className="textarea"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        placeholder={'성함\t학번\t담당LC\n홍길동\t2024000001\t1,2\n김철수\t2024000002\t3'}
      />

      {parsed && (
        <>
          <div className="panel">
            <div className="section-head__title">{parsed.items.length}명 인식됨</div>
            {parsed.errors.length > 0 && (
              <ul
                className="scroll-box"
                style={{
                  margin: '10px 0 0',
                  padding: 0,
                  listStyle: 'none',
                  maxHeight: 130,
                  fontSize: 13,
                  color: 'var(--warn)',
                  lineHeight: 1.8,
                }}
              >
                {parsed.errors.map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="list scroll-box" style={{ overflowY: 'auto' }}>
            {parsed.items.slice(0, 100).map((it, i) => (
              <div key={i} className="list__row">
                <span style={{ fontWeight: 700 }}>{it.login_id}</span>
                <span
                  className="row-end"
                  style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}
                >
                  {it.lcs.length === 0 ? (
                    <Tag tone="bad">LC 없음</Tag>
                  ) : (
                    it.lcs.map((lc) => (
                      <Tag key={lc} tone="accent">
                        {lcLabel(lc)}
                      </Tag>
                    ))
                  )}
                </span>
              </div>
            ))}
          </div>

          <label className={`check is-danger ${replace ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>
              <span className="check__title">기존 FG 계정을 모두 지우고 새로 등록</span>
              <span className="check__desc">접수처 계정은 그대로 유지됩니다.</span>
            </span>
          </label>

          <Button variant={replace ? 'danger' : 'solid'} block loading={saving} onClick={upload}>
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
