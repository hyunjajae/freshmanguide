// Supabase 함수(RPC)를 부르는 곳. 화면 코드는 여기 함수만 쓰면 됩니다.

import { supabase } from './supabase'

/** 세션이 만료됐을 때 던지는 에러 (App.jsx 에서 잡아 로그아웃 처리) */
export class SessionExpiredError extends Error {
  constructor() {
    super('로그인이 만료되었습니다. 다시 로그인해주세요.')
    this.name = 'SessionExpiredError'
  }
}

async function rpc(fn, args = {}) {
  if (!supabase) throw new Error('Supabase 설정이 없습니다. .env.local 을 확인해주세요.')

  const { data, error } = await supabase.rpc(fn, args)

  if (error) {
    const msg = error.message || ''
    if (msg.includes('SESSION_EXPIRED')) throw new SessionExpiredError()
    if (msg.includes('FORBIDDEN')) throw new Error('권한이 없습니다.')
    // 네트워크가 끊겼을 때 supabase-js 가 주는 메시지를 사람 말로 바꿔줍니다
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error('네트워크에 연결할 수 없습니다.')
    }
    throw new Error(msg || '알 수 없는 오류가 발생했습니다.')
  }

  return data
}

// ── 공개 ────────────────────────────────────────────────────────────
export const getSettings = () => rpc('app_settings')

// ── 인증 ────────────────────────────────────────────────────────────
export const login = (role, id, key) =>
  rpc('app_login', { p_role: role, p_id: id, p_key: key })

export const logout = (token) => rpc('app_logout', { p_token: token })

// ── 명단 / 접수 ─────────────────────────────────────────────────────
export const getRoster = (token) => rpc('app_roster', { p_token: token })

export const checkIn = (token, id) =>
  rpc('app_check_in', { p_token: token, p_id: id })

export const undoCheckIn = (token, id) =>
  rpc('app_undo_check_in', { p_token: token, p_id: id })

export const addWalkin = (token, { name, phone, studentId, lc, dept, checkInNow }) =>
  rpc('app_add_walkin', {
    p_token: token,
    p_name: name,
    p_phone: phone,
    p_student_id: studentId || null,
    p_lc: lc,
    p_dept: dept,
    p_check_in: checkInNow,
  })

export const getStats = (token) => rpc('app_stats', { p_token: token })

// ── 관리 ────────────────────────────────────────────────────────────
export const uploadParticipants = (token, rows, replace) =>
  rpc('app_upload_participants', { p_token: token, p_rows: rows, p_replace: replace })

export const uploadFgAccounts = (token, rows, replace) =>
  rpc('app_upload_fg_accounts', { p_token: token, p_rows: rows, p_replace: replace })

export const listAccounts = (token) => rpc('app_list_accounts', { p_token: token })

export const upsertAccount = (token, { role, loginId, loginKey, lcs }) =>
  rpc('app_upsert_account', {
    p_token: token,
    p_role: role,
    p_id: loginId,
    p_key: loginKey,
    p_lcs: lcs ?? [],
  })

export const deleteAccount = (token, id) =>
  rpc('app_delete_account', { p_token: token, p_id: id })

export const setSetting = (token, key, value) =>
  rpc('app_set_setting', { p_token: token, p_key: key, p_value: value })
