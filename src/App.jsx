// 앱 전체의 뼈대
// ------------------------------------------------------------------
// 여기서 하는 일
//   1. 로그인 세션 관리 (새로고침해도 유지)
//   2. 명단 데이터를 한 곳에서 관리하고 각 화면에 내려줌
//   3. 실시간 방송을 듣고 명단을 즉시 갱신
//   4. 60초마다 서버와 다시 맞춰보는 안전장치 (방송을 놓쳤을 경우 대비)

import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './lib/api'
import { SessionExpiredError } from './lib/api'
import { isConfigured } from './lib/supabase'
import { loadSession, saveSession, clearSession } from './lib/session'
import { connectRealtime } from './lib/realtime'
import { useToast } from './components/Toast'
import { useOnline } from './hooks/useOnline'
import { Spinner } from './components/UI'

import SetupNeeded from './screens/SetupNeeded'
import RoleSelect from './screens/RoleSelect'
import Login from './screens/Login'
import AdminScreen from './screens/AdminScreen'
import FgScreen from './screens/FgScreen'
import ManageScreen from './screens/ManageScreen'
import ManagerGate from './screens/ManagerGate'

const RESYNC_INTERVAL = 60_000 // 안전장치: 60초마다 전체 재확인

export default function App() {
  const showToast = useToast()
  const online = useOnline()

  const [settings, setSettings] = useState({ lc_per_day: 31, total_days: 3 })
  const [session, setSession] = useState(null)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [booting, setBooting] = useState(true)

  // 'role' | 'login' | 'main' | 'manage'
  const [screen, setScreen] = useState('role')
  const [pendingRole, setPendingRole] = useState(null)

  // 관리 화면 전용 세션 (접수처 세션과 별개, 저장하지 않고 그때그때 확인)
  const [managerSession, setManagerSession] = useState(null)
  const [gateOpen, setGateOpen] = useState(false)

  const sessionRef = useRef(null)
  sessionRef.current = session

  // ── 설정값 불러오기 ────────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) {
      setBooting(false)
      return
    }

    let alive = true
    ;(async () => {
      try {
        const s = await api.getSettings()
        if (alive && s) {
          setSettings({
            event_name: s.event_name || '팀빌딩 접수',
            lc_per_day: Number(s.lc_per_day) || 31,
            total_days: Number(s.total_days) || 3,
          })
        }
      } catch {
        // 설정을 못 불러와도 기본값으로 계속 진행
      }

      // 저장된 로그인 세션이 있으면 이어서 사용
      const saved = loadSession()
      if (alive && saved) {
        setSession(saved)
        setScreen('main')
      }
      if (alive) setBooting(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  // ── 로그아웃 ──────────────────────────────────────────────────────
  const handleLogout = useCallback(
    (message) => {
      const token = sessionRef.current?.token
      if (token) api.logout(token).catch(() => {})
      clearSession()
      setSession(null)
      setRoster([])
      setPendingRole(null)
      setManagerSession(null)
      setGateOpen(false)
      setScreen('role')
      if (message) showToast(message, 'warn')
    },
    [showToast]
  )

  // 세션 만료 에러를 한 곳에서 처리
  const handleError = useCallback(
    (err, fallback = '오류가 발생했습니다.') => {
      if (err instanceof SessionExpiredError) {
        handleLogout(err.message)
        return
      }
      showToast(err?.message || fallback, 'error')
    },
    [handleLogout, showToast]
  )

  // ── 명단 불러오기 ─────────────────────────────────────────────────
  const refreshRoster = useCallback(
    async ({ silent = false } = {}) => {
      const token = sessionRef.current?.token
      if (!token) return
      if (!silent) setRosterLoading(true)
      try {
        const data = await api.getRoster(token)
        setRoster(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!silent) handleError(err, '명단을 불러오지 못했습니다.')
        else if (err instanceof SessionExpiredError) handleLogout(err.message)
      } finally {
        if (!silent) setRosterLoading(false)
      }
    },
    [handleError, handleLogout]
  )

  // 로그인되면 명단을 한 번 불러옵니다
  useEffect(() => {
    if (session?.token) refreshRoster()
  }, [session?.token, refreshRoster])

  // ── 실시간 방송 수신 ──────────────────────────────────────────────
  useEffect(() => {
    if (!session?.token) return

    const disconnect = connectRealtime(({ id, checkedInAt }) => {
      // 내 명단에 있는 사람이면 즉시 반영, 없으면 무시
      setRoster((prev) => {
        const idx = prev.findIndex((p) => p.id === id)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], checked_in_at: checkedInAt }
        return next
      })
    })

    return disconnect
  }, [session?.token])

  // ── 안전장치: 주기적 재동기화 ─────────────────────────────────────
  useEffect(() => {
    if (!session?.token) return

    const tick = () => {
      // 화면이 안 보이는 동안에는 낭비하지 않습니다
      if (document.visibilityState !== 'visible') return
      if (!navigator.onLine) return
      refreshRoster({ silent: true })
    }

    const timer = setInterval(tick, RESYNC_INTERVAL)

    // 다른 앱 갔다가 돌아오면 즉시 맞춰봅니다
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRoster({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session?.token, refreshRoster])

  // 인터넷이 다시 연결되면 자동으로 맞춰봅니다
  const prevOnline = useRef(online)
  useEffect(() => {
    if (!prevOnline.current && online && session?.token) {
      showToast('연결이 복구되었습니다. 명단을 갱신합니다.', 'success')
      refreshRoster({ silent: true })
    }
    prevOnline.current = online
  }, [online, session?.token, refreshRoster, showToast])

  // ── 로그인 성공 ───────────────────────────────────────────────────
  const handleLoginSuccess = (data) => {
    const s = {
      token: data.token,
      role: data.role,
      name: data.name,
      lcs: Array.isArray(data.lcs) ? data.lcs : [],
    }
    saveSession(s)
    setSession(s)
    setScreen('main')
  }

  // 명단이 바뀌었을 때 각 화면에서 부르는 함수 (낙관적 업데이트용)
  const patchParticipant = useCallback((id, changes) => {
    setRoster((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], ...changes }
      return next
    })
  }, [])

  const addParticipant = useCallback((participant) => {
    setRoster((prev) => [...prev, participant])
  }, [])

  // ── 운영자 확인 ───────────────────────────────────────────────────
  // 관리 화면은 접수처 계정만으로는 못 들어갑니다. 별도 계정을 한 번 더 확인합니다.
  const openManage = () => setGateOpen(true)

  const handleGatePass = (managerSess) => {
    setManagerSession(managerSess)
    setGateOpen(false)
    setScreen('manage')
  }

  const leaveManage = () => {
    // 관리 화면을 나가면 운영자 세션도 정리합니다 (다음에 다시 물어보도록)
    if (managerSession?.token) api.logout(managerSession.token).catch(() => {})
    setManagerSession(null)
    setScreen('main')
  }

  // ── 렌더링 ────────────────────────────────────────────────────────

  if (!isConfigured) return <SetupNeeded />

  if (booting) {
    return (
      <div className="loading" style={{ minHeight: '100dvh' }}>
        <Spinner size={26} />
      </div>
    )
  }

  // 운영자로 직접 로그인해도 접수 화면을 쓸 수 있게 합니다
  const isDesk = session?.role === 'ADMIN' || session?.role === 'MANAGER'

  const shared = {
    session,
    settings,
    roster,
    rosterLoading,
    online,
    refreshRoster,
    patchParticipant,
    addParticipant,
    onLogout: () => handleLogout(),
    onError: handleError,
    showToast,
  }

  return (
    <>
      <OfflineBanner online={online} />

      {screen === 'role' && (
        <RoleSelect
          settings={settings}
          onSelect={(role) => {
            setPendingRole(role)
            setScreen('login')
          }}
        />
      )}

      {screen === 'login' && (
        <Login
          role={pendingRole}
          settings={settings}
          onBack={() => setScreen('role')}
          onSuccess={handleLoginSuccess}
        />
      )}

      {screen === 'main' && isDesk && <AdminScreen {...shared} onOpenManage={openManage} />}

      {screen === 'main' && session?.role === 'FG' && <FgScreen {...shared} />}

      {/* 관리 화면은 접수처 세션이 아니라 운영자 세션으로 동작합니다 */}
      {screen === 'manage' && managerSession && (
        <ManageScreen {...shared} session={managerSession} onBack={leaveManage} />
      )}

      <ManagerGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onSuccess={handleGatePass}
        showToast={showToast}
      />
    </>
  )
}

/** 인터넷이 끊겼을 때 화면 맨 위에 붙는 띠 */
function OfflineBanner({ online }) {
  if (online) return null
  return <div className="offline">인터넷 연결이 끊겼습니다 · 연결되면 자동으로 복구됩니다</div>
}
