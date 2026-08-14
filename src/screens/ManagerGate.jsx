// 운영자 확인 창
// ------------------------------------------------------------------
// 명단 업로드 / 계정 관리 / 설정은 접수처 계정만으로는 들어갈 수 없습니다.
// 운영자 아이디와 비밀번호를 한 번 더 확인합니다.
// (행사장에서 접수처 노트북이 잠깐 자리를 비워도 명단이 통째로 지워지는 사고를 막기 위함)

import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { Button, Input, Modal } from '../components/UI'

export default function ManagerGate({ open, onClose, onSuccess, showToast }) {
  const [id, setId] = useState('')
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const idRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setId('')
    setKey('')
    // 모달이 그려진 뒤에 커서를 넣습니다
    const t = setTimeout(() => idRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return

    if (!id.trim() || !key.trim()) {
      showToast('아이디와 비밀번호를 모두 입력해주세요.', 'warn')
      return
    }

    setLoading(true)
    try {
      const res = await api.login('MANAGER', id.trim(), key.trim())
      if (!res?.ok) {
        showToast(res?.message || '운영자 정보가 일치하지 않습니다.', 'error')
        setKey('')
        return
      }
      onSuccess({ token: res.token, role: res.role, name: res.name, lcs: [] })
    } catch (err) {
      showToast(err.message || '확인 중 오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="운영자 확인">
      <form onSubmit={submit} className="stack" style={{ gap: 18 }}>
        <p className="note note--warn">
          명단 업로드·계정 관리·설정은 운영자만 들어갈 수 있습니다. 실수로 명단이 지워지는 것을
          막기 위한 절차입니다.
        </p>

        <Input
          ref={idRef}
          label="운영자 아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          label="비밀번호"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />

        <div className="row" style={{ gap: 10 }}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            취소
          </Button>
          <Button type="submit" variant="solid" loading={loading} style={{ flex: 2 }}>
            {loading ? '확인 중' : '들어가기'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
