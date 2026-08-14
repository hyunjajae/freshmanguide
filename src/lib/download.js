// CSV 내보내기
// ------------------------------------------------------------------
// 엑셀에서 한글이 깨지지 않도록 파일 맨 앞에 BOM(﻿) 을 붙입니다.
// 이게 없으면 엑셀이 UTF-8을 못 알아채고 "�곗씠��" 처럼 보입니다.

/** 값 하나를 CSV 칸으로 감쌉니다 (쉼표·따옴표·줄바꿈 안전) */
function cell(v) {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * @param {string}   filename  받을 파일 이름 (.csv 는 자동으로 붙습니다)
 * @param {string[]} headers   첫 줄에 들어갈 열 이름
 * @param {any[][]}  rows      데이터 행
 */
export function downloadCsv(filename, headers, rows) {
  const text =
    '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')

  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 브라우저가 내려받기를 시작할 시간을 준 뒤에 정리합니다
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 파일 이름에 붙일 오늘 날짜 (2026-08-15) */
export function today() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
