// CSV / 엑셀 붙여넣기 파싱
// ------------------------------------------------------------------
// 지원하는 방식 2가지
//   1) 구글시트/엑셀에서 "CSV로 다운로드" 한 파일을 끌어다 놓기  → 쉼표(,) 구분
//   2) 구글시트/엑셀에서 그냥 전체 선택 후 Ctrl+C → 붙여넣기      → 탭(\t) 구분
// 별도 라이브러리 없이 둘 다 처리합니다.

/** 첫 줄을 보고 구분자가 쉼표인지 탭인지 알아냅니다. */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const tabs = (firstLine.match(/\t/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  return tabs > commas ? '\t' : ','
}

/**
 * 표 형태 텍스트를 2차원 배열로 변환합니다.
 * 따옴표로 감싼 값("김,현규") 안의 구분자와 줄바꿈도 올바르게 처리합니다.
 */
export function parseTable(text) {
  if (!text) return []
  const delim = detectDelimiter(text)

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"' // 따옴표 이스케이프 ("")
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }

  // 마지막 줄 마무리
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // 완전히 빈 줄은 제거
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

/**
 * 헤더 이름을 보고 어떤 열이 무엇인지 자동으로 추측합니다.
 * 구글폼 질문 제목이 조금씩 달라도 알아서 찾아냅니다.
 */
const COLUMN_HINTS = {
  name: ['이름', '성함', '성명', 'name'],
  lc: ['lc', '엘씨', '조', '팀'],
  phone: ['연락처', '전화', '휴대', '핸드폰', '번호', 'phone', 'tel'],
  dept: ['계열', '학과', '전공', '단과', 'dept', 'major'],
}

const FIELD_ORDER = ['name', 'lc', 'phone', 'dept']

export function guessColumns(header) {
  const result = { name: -1, phone: -1, lc: -1, dept: -1 }
  const used = new Set()

  for (const field of FIELD_ORDER) {
    const hints = COLUMN_HINTS[field]
    for (let i = 0; i < header.length; i++) {
      if (used.has(i)) continue
      const h = String(header[i] || '').toLowerCase().replace(/\s/g, '')
      if (hints.some((hint) => h.includes(hint))) {
        result[field] = i
        used.add(i)
        break
      }
    }
  }

  return result
}

/** 첫 줄이 헤더처럼 보이는지 (숫자만 있는 줄이면 데이터로 봅니다) */
export function looksLikeHeader(firstRow) {
  if (!firstRow) return false
  const joined = firstRow.join('').toLowerCase()
  const anyHint = Object.values(COLUMN_HINTS).flat().some((h) => joined.includes(h))
  return anyHint
}
