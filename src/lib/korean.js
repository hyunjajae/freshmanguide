// 한글 초성 검색 유틸
// "ㄱㅎㄱ" 이라고 치면 "김현규" 가 나오게 해주는 부분입니다.

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const HANGUL_START = 0xac00 // '가'
const HANGUL_END = 0xd7a3   // '힣'

/** 문자열에서 초성만 뽑아냅니다. 김현규 → ㄱㅎㄱ */
export function toChosung(text) {
  if (!text) return ''
  let out = ''
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0)
    if (code >= HANGUL_START && code <= HANGUL_END) {
      out += CHOSUNG[Math.floor((code - HANGUL_START) / 588)]
    } else {
      out += ch
    }
  }
  return out
}

/** 입력값이 초성만으로 이루어져 있는지 (ㄱㅎㄱ → true, 김현 → false) */
export function isChosungQuery(text) {
  const t = String(text || '').replace(/\s/g, '')
  return t.length > 0 && /^[ㄱ-ㅎ]+$/.test(t)
}
