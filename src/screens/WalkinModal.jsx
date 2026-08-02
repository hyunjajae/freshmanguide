// 현장 등록 — 명단에 없는 사람이 왔을 때 바로 추가합니다.

import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { isValidPhone, normalizePhone, dayOfLc, lcLabel } from '../lib/format'
import { Button, Input, Modal } from '../components/UI'

const EMPTY = { name: '', phone: '', lc: '', dept: '', studentId: '', checkInNow: true }

export default function WalkinModal({
  open,
  onClose,
  session,
  settings,
  onAdded,
  onError,
  showToast,
}) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(EMPTY) // 열 때마다 초기화
  }, [open])

  const lcPerDay = settings.lc_per_day || 31
  const totalDays = settings.total_days || 3
  const maxLc = lcPerDay * totalDays

  const lcNum = parseInt(String(form.lc).replace(/[^0-9]/g, ''), 10)
  const lcValid = Number.isFinite(lcNum) && lcNum >= 1 && lcNum <= maxLc
  const day = lcValid ? dayOfLc(lcNum, lcPerDay) : null

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return

    if (!form.name.trim()) return showToast('이름을 입력해주세요.', 'warn')
    if (!lcValid) return showToast(`LC 번호를 1~${maxLc} 사이로 입력해주세요.`, 'warn')
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      return showToast('연락처는 010으로 시작하는 11자리로 입력해주세요.', 'warn')
    }

    setSaving(true)
    try {
      const res = await api.addWalkin(session.token, {
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        studentId: form.studentId.replace(/[^0-9]/g, ''),
        lc: lcNum,
        dept: form.dept.trim(),
        checkInNow: form.checkInNow,
      })

      if (!res?.ok) {
        showToast(res?.message || '등록에 실패했습니다.', 'error')
        return
      }

      onAdded(res.participant)
      showToast(
        `${res.participant.name}님을 ${lcLabel(lcNum)}에 등록${form.checkInNow ? '하고 접수' : ''}했습니다.`,
        'success'
      )
      onClose()
    } catch (err) {
      onError(err, '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="➕ 현장 등록">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          명단에 없는 참가자를 추가합니다. 등록된 인원은 명단에{' '}
          <b>&lsquo;현장&rsquo;</b> 표시가 붙습니다.
        </p>

        <Input
          label="이름 *"
          value={form.name}
          onChange={set('name')}
          placeholder="홍길동"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="LC 번호 *"
              value={form.lc}
              onChange={set('lc')}
              placeholder={`1 ~ ${maxLc}`}
              inputMode="numeric"
              autoComplete="off"
            />
            {day && (
              <p className="mt-1 text-xs font-semibold text-blue-600">
                {lcLabel(lcNum)} · {day}일차
              </p>
            )}
            {form.lc && !lcValid && (
              <p className="mt-1 text-xs font-semibold text-red-600">
                1 ~ {maxLc} 사이로 입력해주세요
              </p>
            )}
          </div>

          <Input
            label="계열"
            value={form.dept}
            onChange={set('dept')}
            placeholder="인문계열"
            autoComplete="off"
          />
        </div>

        <Input
          label="학번"
          value={form.studentId}
          onChange={set('studentId')}
          placeholder="2024001234"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
        />

        <Input
          label="연락처"
          value={form.phone}
          onChange={set('phone')}
          placeholder="01012345678"
          inputMode="numeric"
          autoComplete="off"
          hint="학번·연락처는 선택 사항이지만, 나중에 확인이 필요할 수 있어 받아두면 좋습니다."
        />

        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={form.checkInNow}
            onChange={set('checkInNow')}
            className="h-5 w-5 rounded border-slate-300 accent-emerald-600"
          />
          <span className="text-sm font-semibold text-slate-700">
            추가하면서 바로 접수 처리하기
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button type="submit" variant="green" loading={saving} className="flex-[2]">
            {form.checkInNow ? '등록하고 접수' : '등록만 하기'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
