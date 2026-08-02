// 참가자 명단 업로드 + 중복/오류 검사
// ------------------------------------------------------------------
// 기존 스프레드시트의 "검토 필요" 탭을 이 화면 하나가 대신합니다.
// 흐름:  파일/붙여넣기 → 열 자동인식 → 검사 결과 확인 → 업로드

import { useMemo, useRef, useState } from 'react'
import * as api from '../lib/api'
import { parseTable, guessColumns, looksLikeHeader } from '../lib/csv'
import { analyze, toUploadRows, ISSUE_LABEL } from '../lib/dedupe'
import { lcLabel } from '../lib/format'
import { Badge, Button, Input, Spinner } from '../components/UI'

const FIELD_LABELS = {
  name: '이름',
  lc: 'LC 번호',
  phone: '연락처',
  studentId: '학번',
  dept: '계열',
}
const FIELD_ORDER = ['name', 'lc', 'phone', 'studentId', 'dept']

export default function ParticipantUpload({ session, settings, currentCount, onDone, onError, showToast }) {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [cols, setCols] = useState({ name: -1, phone: -1, lc: -1, dept: -1, studentId: -1 })
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
  const dataRows = useMemo(() => (rows ? (hasHeader ? rows.slice(1) : rows) : []), [rows, hasHeader])

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

  const excludeAllFlagged = () => {
    if (!report) return
    setExcluded(new Set(report.flagged.map((it) => it.key)))
  }

  const includeAllFlagged = () => setExcluded(new Set())

  // ── 업로드 ────────────────────────────────────────────────────────
  const upload = async () => {
    if (finalItems.length === 0) {
      showToast('업로드할 데이터가 없습니다.', 'warn')
      return
    }
    if (replace && confirmText.trim() !== '전체교체') {
      showToast('확인 문구를 정확히 입력해주세요.', 'warn')
      return
    }

    setUploading(true)
    try {
      const res = await api.uploadParticipants(session.token, toUploadRows(finalItems), replace)
      if (!res?.ok) {
        showToast(res?.message || '업로드에 실패했습니다.', 'error')
        return
      }
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
      <div className="space-y-4">
        <InfoBox>
          구글폼 응답 시트를 <b>파일 → 다운로드 → CSV</b> 로 받아 아래에 끌어다 놓거나,
          시트에서 <b>전체 선택 후 Ctrl+C</b> 해서 붙여넣으세요. 열 이름은 자동으로 인식합니다.
        </InfoBox>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition
                      ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}
        >
          <div className="mb-2 text-3xl">📄</div>
          <p className="font-semibold text-slate-700">CSV 파일을 여기에 끌어다 놓으세요</p>
          <p className="mt-1 text-sm text-slate-400">또는 클릭해서 파일 선택</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400">또는 붙여넣기</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <textarea
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
          className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs
                     focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />

        {raw.trim() && (
          <Button variant="primary" onClick={() => ingest(raw)} className="w-full">
            읽어들이기
          </Button>
        )}
      </div>
    )
  }

  // ── 2단계: 열 매핑 ────────────────────────────────────────────────
  const headerRow = hasHeader ? rows[0] : rows[0].map((_, i) => `${i + 1}번째 열`)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">
          {dataRows.length.toLocaleString()}줄을 읽었습니다
        </p>
        <Button variant="ghost" size="sm" onClick={reset}>
          다시 선택
        </Button>
      </div>

      {/* 헤더 여부 ------------------------------------------------------ */}
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-3">
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={(e) => {
            setHasHeader(e.target.checked)
            setCols(guessColumns(e.target.checked ? rows[0] : []))
          }}
          className="h-4 w-4 accent-slate-900"
        />
        <span className="text-sm font-semibold text-slate-700">
          첫 줄은 제목 줄입니다 (데이터가 아님)
        </span>
      </label>

      {/* 열 매핑 -------------------------------------------------------- */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-slate-800">열 연결</h4>
        <div className="grid grid-cols-2 gap-3">
          {FIELD_ORDER.map((field) => (
            <label key={field} className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                {FIELD_LABELS[field]}
                {(field === 'name' || field === 'lc') && <span className="text-red-500"> *</span>}
              </span>
              <select
                value={cols[field]}
                onChange={(e) => setCols((c) => ({ ...c, [field]: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                           focus:border-slate-900 focus:outline-none"
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
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            이름과 LC 번호 열은 반드시 연결해야 합니다.
          </p>
        )}
      </div>

      {/* 검사 결과 ------------------------------------------------------ */}
      {report && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="정상" value={report.ok.length} color="green" />
            <StatCard label="자동 제거" value={report.autoRemoved.length} color="slate" hint="완전 중복" />
            <StatCard label="확인 필요" value={report.flagged.length} color="amber" />
            <StatCard label="업로드 예정" value={finalItems.length} color="blue" />
          </div>

          {report.flagged.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">
                  확인이 필요한 {report.flagged.length}건
                </h4>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={includeAllFlagged}>
                    전부 포함
                  </Button>
                  <Button variant="ghost" size="sm" onClick={excludeAllFlagged}>
                    전부 제외
                  </Button>
                </div>
              </div>

              <p className="mb-2 text-xs text-slate-500">
                체크를 풀면 그 사람은 업로드되지 않습니다. 빨간 줄은 이름이나 LC가 없어 업로드할 수 없습니다.
              </p>

              <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-xl bg-slate-50 p-2">
                {report.flagged.map((it) => {
                  const included = !it.blocking && !excluded.has(it.key)
                  return (
                    <label
                      key={it.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition
                                  ${it.blocking ? 'border-red-200 opacity-70' : included ? 'border-slate-200' : 'border-slate-200 opacity-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={it.blocking}
                        onChange={() => toggleExclude(it.key)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900">{it.name || '(이름 없음)'}</span>
                          {it.lc !== null && <Badge color="blue">{lcLabel(it.lc)}</Badge>}
                          <Badge color={it.blocking ? 'red' : 'amber'}>
                            {it.blocking ? '업로드 불가' : ISSUE_LABEL[it.issue]}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {it.dept || '계열 없음'} · {it.displayPhone}
                          {it.studentId && ` · 학번 ${it.studentId}`} · 원본 {it.sourceLine}번째 줄
                        </div>
                        <div className="mt-1 text-xs font-semibold text-amber-700">
                          {it.reasons.join(' · ')}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* 업로드 방식 ------------------------------------------------- */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="mb-3 text-sm font-bold text-slate-800">업로드 방식</h4>

            <div className="space-y-2">
              <RadioCard
                checked={replace}
                onChange={() => setReplace(true)}
                title="전체 교체"
                description={`기존 ${currentCount.toLocaleString()}명을 모두 지우고 새로 넣습니다. (접수 기록도 함께 사라집니다)`}
                danger
              />
              <RadioCard
                checked={!replace}
                onChange={() => setReplace(false)}
                title="기존 명단에 추가"
                description="현재 명단은 그대로 두고 뒤에 덧붙입니다."
              />
            </div>

            {replace && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-xs font-bold text-red-800">
                  ⚠️ 되돌릴 수 없습니다. 계속하려면 아래에 <b>전체교체</b> 라고 입력하세요.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="전체교체"
                  className="!py-2 !text-sm"
                />
              </div>
            )}

            <Button
              variant={replace ? 'red' : 'primary'}
              size="lg"
              loading={uploading}
              onClick={upload}
              disabled={
                finalItems.length === 0 ||
                cols.name < 0 ||
                cols.lc < 0 ||
                (replace && confirmText.trim() !== '전체교체')
              }
              className="mt-4 w-full"
            >
              {uploading ? (
                <>
                  <Spinner className="h-4 w-4" /> 업로드 중...
                </>
              ) : (
                `${finalItems.length.toLocaleString()}명 업로드`
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color, hint }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    slate: 'bg-slate-50 text-slate-600 ring-slate-200',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 ring-1 ${colors[color]}`}>
      <div className="text-xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      {hint && <div className="text-[10px] opacity-60">{hint}</div>}
    </div>
  )
}

function RadioCard({ checked, onChange, title, description, danger }) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition
                  ${checked ? (danger ? 'border-red-300 bg-red-50/50' : 'border-slate-900 bg-slate-50') : 'border-slate-200'}`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-slate-900" />
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
      </div>
    </label>
  )
}

function InfoBox({ children }) {
  return (
    <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
      {children}
    </div>
  )
}
