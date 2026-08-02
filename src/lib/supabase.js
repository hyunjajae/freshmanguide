import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// .env.local 을 아직 안 만들었을 때 흰 화면 대신 안내를 띄우기 위한 플래그
export const isConfigured =
  Boolean(url && key) && !url.includes('여기에') && !key.includes('여기에')

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: false }, // 로그인은 우리가 직접 처리하므로 끔
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null
