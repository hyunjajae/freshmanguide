// 로그인 화면

import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { Button, Icon, Input } from '../components/UI'
import { useToast } from '../components/Toast'

export default function Login({ role, settings, onBack, onSuccess }) {
  const showToast = useToast()
  const [loginId, setLoginId] = useState('')
  const [loginKey, setLoginKey] = useState('')
  const [loading, setLoading] = useState(false)
  const idRef = useRef(null)

  const isAdmin = role === 'ADMIN'
  // 성함 칸에는 inputMode 를 주지 않습니다 — 숫자 키패드가 뜨면 이름을 못 칩니다
  const labels = isAdmin
    ? { title: '접수처', id: '아이디', key: '비밀번호', idHint: '접수처 아이디', keyHint: '비밀번호' }
    : { title: '진행 FG', id: '성함', key: '학번', idHint: '홍길동', keyHint: '학번 10자리' }

  useEffect(() => {
    idRef.current?.focus()
  }, [])

  const submit = async (e) => {
    e?.preventDefault()
    if (loading) return

    if (!loginId.trim() || !loginKey.trim()) {
      showToast(`${labels.id}와 ${labels.key}를 모두 입력해주세요.`, 'warn')
      return
    }

    setLoading(true)
    try {
      const res = await api.login(role, loginId.trim(), loginKey.trim())
      if (!res?.ok) {
        showToast(res?.message || '로그인에 실패했습니다.', 'error')
        setLoginKey('')
        return
      }
      onSuccess(res)
    } catch (err) {
      showToast(err.message || '로그인 중 오류가 발생했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app rise">
      <div className="wrap wrap--narrow">
        <div style={{ paddingTop: 22 }}>
          <button className="back-btn" onClick={onBack}>
            <Icon.chevronLeft />
            뒤로
          </button>
        </div>

        <header className="hero" style={{ marginTop: 18 }}>
          <img className="hero__logo" src="/logo.png" alt="Freshman Guide" />
          <p className="eyebrow eyebrow--muted">{settings.event_name || '팀빌딩 접수'}</p>
          <h1 className="title title--sm">{labels.title} 로그인</h1>
        </header>

        <form className="card" onSubmit={submit}>
          <div className="card__body stack" style={{ gap: 18 }}>
            <Input
              ref={idRef}
              label={labels.id}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder={labels.idHint}
              autoComplete="off"
              spellCheck={false}
            />

            <Input
              label={labels.key}
              type="password"
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder={labels.keyHint}
              autoComplete="off"
              inputMode={isAdmin ? 'text' : 'numeric'}
              maxLength={isAdmin ? undefined : 10}
            />

            <Button type="submit" variant="solid" size="lg" block loading={loading}>
              {loading ? '접속 중' : '접속'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
