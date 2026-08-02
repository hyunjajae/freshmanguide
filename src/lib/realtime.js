// 실시간 동기화
// ------------------------------------------------------------------
// 접수처에서 [접수] 를 누르면 → 방송(broadcast)을 쏩니다.
// FG 화면들은 그 방송을 듣고 있다가 자기 담당 LC면 즉시 화면을 갱신합니다.
// 서버를 다시 부르지 않으므로 사람이 아무리 많아도 부담이 없습니다.
//
// 방송에는 개인정보(연락처)를 절대 싣지 않습니다. id / lc / 접수시각만 보냅니다.

import { supabase } from './supabase'

const CHANNEL_NAME = 'checkin-room'

let channel = null

/**
 * 실시간 채널에 접속합니다.
 * @param {(payload:{id:string, lc:number, checkedInAt:string|null, kind:string}) => void} onUpdate
 * @param {(status:string) => void} [onStatus]
 * @returns {() => void} 정리(연결 해제) 함수
 */
export function connectRealtime(onUpdate, onStatus) {
  if (!supabase) return () => {}

  const myChannel = supabase.channel(CHANNEL_NAME)
  channel = myChannel

  myChannel
    .on('broadcast', { event: 'checkin' }, ({ payload }) => {
      if (payload) onUpdate(payload)
    })
    .subscribe((status) => {
      if (onStatus) onStatus(status)
    })

  // 내가 만든 채널만 정리합니다.
  // (개발 모드에서 React가 효과를 두 번 실행할 때 남의 채널을 끊지 않도록)
  return () => {
    supabase.removeChannel(myChannel)
    if (channel === myChannel) channel = null
  }
}

/** 접수/취소가 일어났음을 다른 화면들에 알립니다. */
export function broadcastCheckin({ id, lc, checkedInAt, kind }) {
  if (!channel) return
  channel.send({
    type: 'broadcast',
    event: 'checkin',
    payload: { id, lc, checkedInAt, kind },
  })
}
