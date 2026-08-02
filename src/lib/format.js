// 화면에 보여줄 값들을 다듬는 함수 모음

/** 연락처에서 숫자만 남기고, 10자리 "10xxxxxxxx" 는 앞에 0을 붙여줍니다. */
export function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/[^0-9]/g, '')
  if (digits.length === 10 && digits.startsWith('10')) digits = '0' + digits
  return digits
}

/** 01012345678 → 010-1234-5678 (마스킹된 값은 그대로 통과) */
export function formatPhone(raw) {
  if (!raw) return ''
  const s = String(raw)
  if (s.includes('*')) return s // FG 화면의 ****5678
  const d = normalizePhone(s)
  if (d.length === 11) return d.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  if (d.length === 10) return d.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  return s
}

/** 올바른 휴대폰 번호인지 (010으로 시작하는 11자리) */
export function isValidPhone(raw) {
  const d = normalizePhone(raw)
  return d.length === 11 && d.startsWith('010')
}

/** 7 → "LC07" */
export function lcLabel(lc) {
  const n = Number(lc)
  if (!Number.isFinite(n)) return String(lc ?? '')
  return 'LC' + String(n).padStart(2, '0')
}

/** LC 번호로 몇 일차인지 계산 (하루 31개 기준: 1~31=1일차, 32~62=2일차 ...) */
export function dayOfLc(lc, lcPerDay = 31) {
  const n = Number(lc)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.floor((n - 1) / lcPerDay) + 1
}

/** 특정 일차의 LC 범위 [시작, 끝] */
export function lcRangeOfDay(day, lcPerDay = 31) {
  return [(day - 1) * lcPerDay + 1, day * lcPerDay]
}

/** ISO 시각 → "14:23:05" */
export function timeOnly(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** ISO 시각 → "3분 전" */
export function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5) return '방금'
  if (diff < 60) return `${diff}초 전`
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

/** 0.734 → 73 (퍼센트 정수) */
export function percent(done, total) {
  if (!total) return 0
  return Math.round((done / total) * 100)
}
