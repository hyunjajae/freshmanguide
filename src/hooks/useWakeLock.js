// 접수 중에 화면이 저절로 꺼지지 않게 합니다.
// (접수처 태블릿, FG 폰이 계속 켜져 있어야 하므로)
// 지원하지 않는 브라우저에서는 조용히 아무 일도 하지 않습니다.

import { useEffect } from 'react'

export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let lock = null
    let cancelled = false

    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // 배터리 절약 모드 등에서 거부될 수 있음 — 무시
      }
    }

    // 다른 탭에 갔다가 돌아오면 잠금이 풀리므로 다시 요청
    const onVisible = () => {
      if (!cancelled && document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [active])
}
