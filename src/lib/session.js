// 로그인 세션을 브라우저에 저장 → 새로고침해도 로그인이 풀리지 않습니다.

const KEY = 'teambuilding_session_v2'

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 앱은 계속 동작해야 하므로 무시
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.token || !s?.role) return null
    return s
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}
