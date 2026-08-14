// 명단 정제 + 중복/오류 검사
// ------------------------------------------------------------------
// 기존 스프레드시트의 "검토 필요" 탭이 하던 일을 여기서 합니다.
//   · 완전 중복 (이름·연락처·LC·계열이 전부 같음)  → 자동으로 하나만 남김
//   · 중복 의심 (연락처가 같거나, 이름+LC+계열이 같음) → 사람이 확인
//   · 형식 오류 (연락처가 010 11자리가 아님, LC 범위 밖, 이름 없음) → 사람이 확인

import { normalizePhone, isValidPhone, formatPhone } from './format'
import { toChosung } from './korean'

export const ISSUE = {
  NONE: 'none',
  FORMAT: 'format',      // 형식 오류
  DUPLICATE: 'duplicate',// 중복 의심
  BOTH: 'both',
}

export const ISSUE_LABEL = {
  [ISSUE.FORMAT]: '형식 오류',
  [ISSUE.DUPLICATE]: '중복 의심',
  [ISSUE.BOTH]: '형식 오류 + 중복 의심',
}

/**
 * @param {string[][]} rows      데이터 행 (헤더 제외)
 * @param {{name:number, phone:number, lc:number, dept:number}} cols  열 위치
 * @param {number} maxLc         LC 최대 번호 (예: 93)
 */
export function analyze(rows, cols, maxLc) {
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

  // 1) 값 정리 -------------------------------------------------------
  const items = rows.map((row, index) => {
    const name = clean(cols.name >= 0 ? row[cols.name] : '')
    const phone = normalizePhone(cols.phone >= 0 ? row[cols.phone] : '')
    const lcRaw = clean(cols.lc >= 0 ? row[cols.lc] : '')
    const lc = parseInt(String(lcRaw).replace(/[^0-9]/g, ''), 10)
    const dept = clean(cols.dept >= 0 ? row[cols.dept] : '')

    return {
      key: `row-${index}`,
      sourceLine: index + 2, // 원본 파일 기준 줄 번호 (헤더 1줄 가정)
      name,
      phone,
      displayPhone: phone ? formatPhone(phone) : '(없음)',
      lc: Number.isFinite(lc) ? lc : null,
      dept,
      chosung: toChosung(name),
      reasons: [],
    }
  })

  // 2) 완전 중복 제거 -------------------------------------------------
  const seen = new Set()
  const kept = []
  const autoRemoved = []

  for (const item of items) {
    const fullKey = [item.name, item.phone, item.lc, item.dept].join('|')
    if (seen.has(fullKey)) {
      autoRemoved.push(item)
    } else {
      seen.add(fullKey)
      kept.push(item)
    }
  }

  // 3) 형식 오류 검사 -------------------------------------------------
  for (const item of kept) {
    if (!item.name) item.reasons.push('이름이 비어 있음')
    if (item.lc === null) item.reasons.push('LC 번호 없음')
    else if (item.lc < 1 || item.lc > maxLc) item.reasons.push(`LC 범위 밖 (1~${maxLc})`)
    if (!item.phone) item.reasons.push('연락처 없음')
    else if (!isValidPhone(item.phone)) item.reasons.push('연락처 형식 오류')
  }

  // 4) 중복 의심 검사 (Map 으로 한 번에 — 인원이 많아도 빠릅니다) ------
  const byPhone = new Map()
  const byNameLcDept = new Map()

  for (const item of kept) {
    if (item.phone) {
      if (!byPhone.has(item.phone)) byPhone.set(item.phone, [])
      byPhone.get(item.phone).push(item)
    }
    if (item.name && item.lc !== null) {
      const k = `${item.name}|${item.lc}|${item.dept}`
      if (!byNameLcDept.has(k)) byNameLcDept.set(k, [])
      byNameLcDept.get(k).push(item)
    }
  }

  const dupGroups = []

  for (const [phone, group] of byPhone) {
    if (group.length > 1) {
      dupGroups.push({ reason: `연락처 중복 (${formatPhone(phone)})`, members: group })
      group.forEach((it) => it.reasons.push('연락처 중복'))
    }
  }
  for (const [, group] of byNameLcDept) {
    if (group.length > 1) {
      // 연락처 중복으로 이미 잡힌 그룹과 완전히 겹치면 중복 표시하지 않음
      const alreadyGrouped = group.every((it) => it.reasons.includes('연락처 중복'))
      if (!alreadyGrouped) {
        dupGroups.push({
          reason: `이름 + LC + 계열 중복 (${group[0].name})`,
          members: group,
        })
        group.forEach((it) => {
          if (!it.reasons.includes('이름/LC/계열 중복')) it.reasons.push('이름/LC/계열 중복')
        })
      }
    }
  }

  // 5) 분류 ----------------------------------------------------------
  const isDupReason = (r) => r.includes('중복')
  const flagged = []
  const ok = []

  for (const item of kept) {
    if (item.reasons.length === 0) {
      ok.push(item)
      continue
    }
    const hasDup = item.reasons.some(isDupReason)
    const hasFmt = item.reasons.some((r) => !isDupReason(r))
    item.issue = hasDup && hasFmt ? ISSUE.BOTH : hasDup ? ISSUE.DUPLICATE : ISSUE.FORMAT
    // 이름이나 LC가 없으면 DB에 넣을 수 없으므로 업로드 불가로 표시
    item.blocking = !item.name || item.lc === null
    flagged.push(item)
  }

  return {
    ok,             // 문제 없는 행
    flagged,        // 확인이 필요한 행
    autoRemoved,    // 완전 중복이라 자동 제거된 행
    dupGroups,      // 중복 의심 묶음 (화면에 나란히 보여주기 위함)
    total: items.length,
  }
}

/** DB에 넣을 형태로 변환 */
export function toUploadRows(items) {
  return items.map((it) => ({
    name: it.name,
    chosung: it.chosung,
    phone: it.phone || '',
    lc: String(it.lc),
    dept: it.dept || '',
  }))
}
