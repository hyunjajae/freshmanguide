// 참가자 명단 업로드 + 중복/오류 검사
// ------------------------------------------------------------------
// 기존 스프레드시트의 "검토 필요" 탭을 이 화면 하나가 대신합니다.
// 흐름:  파일/붙여넣기 → 열 자동인식 → 검사 결과 확인 → 업로드

import { useMemo, useRef, useState } from 'react'
import * as api from '../lib/api'
import { parseTable, guessColumns, looksLikeHeader } from '../lib/csv'
import { analyze, toUploadRows, ISSUE_LABEL } from '../lib/dedupe'
import { lcLabel } from '../lib/format'
import { Button, Icon, Input, Tag } from '../components/UI'

const FIELD_LABELS = {
  name: '이름',
  lc: 'LC 번호',
  phone: '연락처',
  dept: '계열',
}
const FIELD_ORDER = ['name', 'lc', 'phone', 'dept']
const CONFIRM_WORD = '전체교체'

export default function ParticipantUpload({
  session,
  settings,
  currentCount,
  onDone,
  onError,
  showToast,
}) {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [cols, setCols] = useState({ name: -1, phone: -1, lc: -1, dept: -1 })
  const [excluded, setExcluded] = useState(new Set())
  const [replace, setReplace] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const maxLc = (settings.lc_per_day || 31) * (settings.total_days || 3)

  // ── 표 텍스트를 받아 파싱 ─────────────────────────────────────────
  const ingest = (text) => {
    const parsed = parseTable(text)
    if (parsed.length === 0) {
      showToast('읽을 수 있는 데이터가 없습니다.', 'error')
      return
    }
    const header = looksLikeHeader(parsed[0])
    setHasHeader(header)
    setRows(parsed)
    setCols(guessColumns(header ? parsed[0] : []))
    setExcluded(new Set())
    setConfirmText('')
  }

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => ingest(String(e.target.result))
    reader.onerror = () => showToast('파일을 읽지 못했습니다.', 'error')
    reader.readAsText(file, 'utf-8')
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  // ── 검사 실행 ─────────────────────────────────────────────────────
  const dataRows = useMemo(
    () => (rows ? (hasHeader ? rows.slice(1) : rows) : []),
    [rows, hasHeader]
  )

  const report = useMemo(() => {
    if (!rows || cols.name < 0 || cols.lc < 0) return null
    return analyze(dataRows, cols, maxLc)
  }, [rows, dataRows, cols, maxLc])

  // 업로드할 최종 목록 = 정상 + (사용자가 제외하지 않은 확인필요 행)
  const finalItems = useMemo(() => {
    if (!report) return []
    const included = report.flagged.filter((it) => !it.blocking && !excluded.has(it.key))
    return [...report.ok, ...included]
  }, [report, excluded])

  const toggleExclude = (key) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── 업로드 ────────────────────────────────────────────────────────
  const upload = async () => {
    if (finalItems.length === 0) return showToast('업로드할 데이터가 없습니다.', 'warn')
    if (replace && confirmText.trim() !== CONFIRM_WORD) {
      return showToast('확인 문구를 정확히 입력해주세요.', 'warn')
    }

    setUploading(true)
    try {
      const res = await api.uploadParticipants(session.token, toUploadRows(finalItems), replace)
      if (!res?.ok) return showToast(res?.message || '업로드에 실패했습니다.', 'error')
      showToast(`${res.inserted.toLocaleString()}명을 등록했습니다.`, 'success')
      reset()
      onDone()
    } catch (err) {
      onError(err, '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setRaw('')
    setRows(null)
    setExcluded(new Set())
    setConfirmText('')
  }

  // ── 1단계: 데이터 입력 ────────────────────────────────────────────
  if (!rows) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <p className="note note--info">
          구글폼 응답 시트를 <b>파일 → 다운로드 → CSV</b> 로 받아 아래에 끌어다 놓거나, 시트에서{' '}
          <b>전체 선택 후 Ctrl+C</b> 해서 붙여넣으세요. 열 이름은 자동으로 인식합니다.
        </p>

        <button
          type="button"
          className={`dropzone ${dragging ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <span className="dropzone__mark">
            <Icon.file />
          </span>
          <span className="dropzone__title" style={{ display: 'block' }}>
            CSV 파일을 여기에 끌어다 놓으세요
          </span>
          <span className="dropzone__desc" style={{ display: 'block' }}>
            또는 클릭해서 파일 선택
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </button>

        <div className="divider">
          <span>또는 붙여넣기</span>
        </div>

        <textarea
          className="textarea"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (text) {
              e.preventDefault()
              setRaw(text)
              ingest(text)
            }
          }}
          rows={6}
          placeholder={'이름\t학번\t연락처\tLC\t계열\n홍길동\t2024001234\t01012345678\t1\t인문계열'}
        />

        {raw.trim() && (
          <Button variant="solid" block onClick={() => ingest(raw)}>
            읽어들이기
          </Button>
        )}
      </div>
    )
  }

  // ── 2단계: 열 매핑 + 검사 ─────────────────────────────────────────
  const headerRow = hasHeader ? rows[0] : rows[0].map((_, i) => `${i + 1}번째 열`)
  const canUpload =
    finalItems.length > 0 &&
    cols.name >= 0 &&
    cols.lc >= 0 &&
    (!replace || confirmText.trim() === CONFIRM_WORD)

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="section-head__title">{dataRows.length.toLocaleString()}줄을 읽었습니다</span>
        <Button variant="quiet" size="sm" onClick={reset}>
          다시 선택
        </Button>
      </div>

      <label className={`check ${hasHeader ? 'is-on' : ''}`}>
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={(e) => {
            setHasHeader(e.target.checked)
            setCols(guessColumns(e.target.checked ? rows[0] : []))
          }}
        />
        <span>
          <span className="check__title">첫 줄은 제목 줄입니다</span>
          <span className="check__desc">데이터가 아니라 열 이름이 적힌 줄이면 켜두세요.</span>
        </span>
      </label>

      {/* 열 매핑 -------------------------------------------------------- */}
      <section>
        <div className="section-head">
          <span className="section-head__title">열 연결</span>
        </div>
        <div className="grid-2">
          {FIELD_ORDER.map((field) => (
            <label key={field} className="field">
              <span className="field__label">
                {FIELD_LABELS[field]}
                {(field === 'name' || field === 'lc') && <span> *</span>}
              </span>
              <select
                className="select"
                value={cols[field]}
                onChange={(e) => setCols((c) => ({ ...c, [field]: Number(e.target.value) }))}
              >
                <option value={-1}>— 사용 안 함 —</option>
                {headerRow.map((h, i) => (
                  <option key={i} value={i}>
                    {String(h).slice(0, 30) || `${i + 1}번째 열`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {(cols.name < 0 || cols.lc < 0) && (
          <p className="note note--bad" style={{ marginTop: 12 }}>
            이름과 LC 번호 열은 반드시 연결해야 합니다.
          </p>
        )}
      </section>

      {/* 검사 결과 ------------------------------------------------------ */}
      {report && (
        <>
          <div className="tally">
            <div className="tally__item tally__item--ok">
              <div className="tally__num">{report.ok.length.toLocaleString()}</div>
              <div className="tally__label">정상</div>
            </div>
            <div className="tally__item">
              <div className="tally__num">{report.autoRemoved.length.toLocaleString()}</div>
              <div className="tally__label">자동 제거</div>
            </div>
            <div className="tally__item tally__item--warn">
              <div className="tally__num">{report.flagged.length.toLocaleString()}</div>
              <div className="tally__label">확인 필요</div>
            </div>
            <div className="tally__item">
              <div className="tally__num">{finalItems.length.toLocaleString()}</div>
              <div className="tally__label">업로드 예정</div>
            </div>
          </div>

          {report.flagged.length > 0 && (
            <section>
              <div className="section-head">
                <span className="section-head__title">확인이 필요한 {report.flagged.length}건</span>
                <span className="row" style={{ gap: 4 }}>
                  <Button variant="quiet" size="sm" onClick={() => setExcluded(new Set())}>
                    전부 포함
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => setExcluded(new Set(report.flagged.map((it) => it.key)))}
                  >
                    전부 제외
                  </Button>
                </span>
              </div>

              <p style={{ margin: '0 4px 10px', fontSize: 13, color: 'var(--muted)' }}>
                체크를 풀면 그 사람은 업로드되지 않습니다. 빨간 줄은 이름이나 LC가 없어 업로드할 수
                없습니다.
              </p>

              <div className="scroll-box stack-s">
                {report.flagged.map((it) => {
                  const included = !it.blocking && !excluded.has(it.key)
                  return (
                    <label
                      key={it.key}
                      className={`check ${it.blocking ? 'is-locked' : included ? '' : 'is-off'}`}
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={it.blocking}
                        onChange={() => toggleExclude(it.key)}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <span className="check__title">{it.name || '(이름 없음)'}</span>
                          {it.lc !== null && <Tag tone="accent">{lcLabel(it.lc)}</Tag>}
                          <Tag tone={it.blocking ? 'bad' : 'warn'}>
                            {it.blocking ? '업로드 불가' : ISSUE_LABEL[it.issue]}
                          </Tag>
                        </span>
                        <span className="check__desc">
                          {it.dept || '계열 없음'} · {it.displayPhone} · 원본 {it.sourceLine}번째 줄
                        </span>
                        <span
                          className="check__desc"
                          style={{ color: 'var(--warn)', fontWeight: 700 }}
                        >
                          {it.reasons.join(' · ')}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          )}

          {/* 업로드 방식 ------------------------------------------------- */}
          <section className="card">
            <div className="card__body stack" style={{ gap: 12 }}>
              <div className="section-head" style={{ margin: 0 }}>
                <span className="section-head__title">업로드 방식</span>
              </div>

              <label className={`check is-danger ${replace ? 'is-on' : ''}`}>
                <input type="radio" checked={replace} onChange={() => setReplace(true)} />
                <span>
                  <span className="check__title">전체 교체</span>
                  <span className="check__desc">
                    기존 {currentCount.toLocaleString()}명을 모두 지우고 새로 넣습니다. 접수 기록도
                    함께 사라집니다.
                  </span>
                </span>
              </label>

              <label className={`check ${!replace ? 'is-on' : ''}`}>
                <input type="radio" checked={!replace} onChange={() => setReplace(false)} />
                <span>
                  <span className="check__title">기존 명단에 추가</span>
                  <span className="check__desc">현재 명단은 그대로 두고 뒤에 덧붙입니다.</span>
                </span>
              </label>

              {replace && (
                <div className="stack-s">
                  <p className="note note--bad">
                    되돌릴 수 없습니다. 계속하려면 아래에 <b>{CONFIRM_WORD}</b> 라고 입력하세요.
                  </p>
                  <input
                    className="input"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    aria-label="확인 문구"
                  />
                </div>
              )}

              <Button
                variant={replace ? 'danger' : 'solid'}
                size="lg"
                block
                loading={uploading}
                onClick={upload}
                disabled={!canUpload}
              >
                {uploading ? '업로드 중' : `${finalItems.length.toLocaleString()}명 업로드`}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
