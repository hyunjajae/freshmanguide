// 로그인 화면

import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { Button, Input } from '../components/UI'
import { useToast } from '../components/Toast'

export default function Login({ role, settings, onBack, onSuccess }) {
  const showToast = useToast()
  const [loginId, setLoginId] = useState('')
  const [loginKey, setLoginKey] = useState('')
  const [loading, setLoading] = useState(false)
  const idRef = useRef(null)

  const isAdmin = role === 'ADMIN'
  const labels = isAdmin
    ? { title: '접수처 로그인', id: '아이디', key: '비밀번호', keyType: 'password', mode: 'text' }
    : { title: '진행 FG 로그인', id: '성함', key: '학번', keyType: 'password', mode: 'text' }

  useEffect(() => {
    // 모바일에서 자동으로 키보드가 올라오면 오히려 불편해서 focus 만 줍니다
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
    <div className="flex min-h-dvh flex-col px-5 py-6">
      <button
        onClick={onBack}
        className="mb-8 inline-flex w-fit items-center gap-1 rounded-lg py-2 pr-3 text-sm
                   font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        뒤로
      </button>

      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-400">
            {settings.event_name || '팀빌딩 접수'}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{labels.title}</h1>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
          <Input
            ref={idRef}
            label={labels.id}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder={isAdmin ? '접수처 아이디' : '홍길동'}
            autoComplete="off"
            spellCheck={false}
            inputMode={labels.mode}
          />

          <Input
            label={labels.key}
            type={labels.keyType}
            value={loginKey}
            onChange={(e) => setLoginKey(e.target.value)}
            placeholder={isAdmin ? '비밀번호' : '학번 10자리'}
            autoComplete="off"
            inputMode={isAdmin ? 'text' : 'numeric'}
            maxLength={isAdmin ? undefined : 10}
          />

          <Button
            type="submit"
            variant={isAdmin ? 'primary' : 'blue'}
            size="lg"
            loading={loading}
            className="w-full"
          >
            {loading ? '접속 중...' : '접속'}
          </Button>
        </form>
      </div>
    </div>
  )
}
