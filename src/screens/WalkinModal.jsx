// 현장 등록 — 명단에 없는 사람이 왔을 때 바로 추가합니다.

import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { isValidPhone, normalizePhone, dayOfLc, lcLabel } from '../lib/format'
import { Button, Input, Modal } from '../components/UI'

const EMPTY = { name: '', phone: '', lc: '', dept: '', checkInNow: true }

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
    setForm((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

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
    <Modal open={open} onClose={onClose} title="현장 등록">
      <form onSubmit={submit} className="stack" style={{ gap: 18 }}>
        <p className="note note--warn">
          명단에 없는 참가자를 추가합니다. 등록된 인원은 명단에 <b>현장</b> 표시가 붙습니다.
        </p>

        <Input
          label="이름"
          required
          value={form.name}
          onChange={set('name')}
          placeholder="홍길동"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />

        <div className="grid-2">
          <Input
            label="LC 번호"
            required
            value={form.lc}
            onChange={set('lc')}
            placeholder={`1 ~ ${maxLc}`}
            inputMode="numeric"
            autoComplete="off"
            hint={day ? `${lcLabel(lcNum)} · ${day}일차` : undefined}
            error={form.lc && !lcValid ? `1 ~ ${maxLc} 사이로 입력해주세요` : undefined}
          />
          <Input
            label="계열"
            value={form.dept}
            onChange={set('dept')}
            placeholder="인문계열"
            autoComplete="off"
          />
        </div>

        <Input
          label="연락처"
          value={form.phone}
          onChange={set('phone')}
          placeholder="01012345678"
          inputMode="numeric"
          autoComplete="off"
          hint="선택 사항이지만 나중에 연락할 일이 생길 수 있어 받아두면 좋습니다."
        />

        <label className={`check ${form.checkInNow ? 'is-on' : ''}`}>
          <input type="checkbox" checked={form.checkInNow} onChange={set('checkInNow')} />
          <span>
            <span className="check__title">추가하면서 바로 접수 처리</span>
            <span className="check__desc">
              지금 현장에 와 있는 참가자라면 켜두세요.
            </span>
          </span>
        </label>

        <div className="row" style={{ gap: 10 }}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            취소
          </Button>
          <Button type="submit" variant="solid" loading={saving} style={{ flex: 2 }}>
            {form.checkInNow ? '등록하고 접수' : '등록만 하기'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
