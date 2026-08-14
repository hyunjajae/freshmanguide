// 여러 화면에서 공통으로 쓰는 작은 부품들
// 스타일은 전부 styles.css 에 있고, 여기서는 클래스 이름만 붙입니다.

import { forwardRef, useEffect, useRef } from 'react'

/* ---------- 아이콘 ----------
   외부 아이콘 라이브러리를 쓰지 않고 필요한 것만 직접 그렸습니다. */
export const Icon = {
  chevronRight: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  ),
  chevronLeft: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  ),
  close: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" {...p}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  ),
  search: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" {...p}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2 17 17" />
    </svg>
  ),
  refresh: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16.5 8.5A6.5 6.5 0 1 0 16 12" />
      <path d="M16.8 4.5v4h-4" />
    </svg>
  ),
  // 톱니바퀴. 예전에는 가운데 점 + 사방으로 뻗은 선이라 '해' 처럼 보였습니다.
  // 이제 톱니 8개가 달린 고리를 칠하고 가운데를 뚫습니다(evenodd).
  settings: (p) => (
    <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.46 3.58 L8.67 1.6 L11.33 1.6 L11.54 3.58 L13.45 4.37 L15 3.12 L16.88 5 L15.63 6.55 L16.42 8.46 L18.4 8.67 L18.4 11.33 L16.42 11.54 L15.63 13.45 L16.88 15 L15 16.88 L13.45 15.63 L11.54 16.42 L11.33 18.4 L8.67 18.4 L8.46 16.42 L6.55 15.63 L5 16.88 L3.12 15 L4.37 13.45 L3.58 11.54 L1.6 11.33 L1.6 8.67 L3.58 8.46 L4.37 6.55 L3.12 5 L5 3.12 L6.55 4.37 Z M13.1 10 A3.1 3.1 0 1 0 6.9 10 A3.1 3.1 0 1 0 13.1 10 Z"
      />
    </svg>
  ),
  plus: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" {...p}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  ),
  clipboard: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7.5 3.5h5v2h-5z" />
      <path d="M12.5 4.5h2.5v12H5v-12h2.5" />
      <path d="M7.8 9.5h4.4M7.8 12.5h3" />
    </svg>
  ),
  chart: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" {...p}>
      <path d="M4 16V9M10 16V4M16 16v-5" />
    </svg>
  ),
  file: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11.5 2.5H5v15h10V6z" />
      <path d="M11.5 2.5V6H15" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  ),
  user: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" {...p}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.2 2.7-5 6-5s6 1.8 6 5" />
    </svg>
  ),
  inbox: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2.5 12h4l1 2h5l1-2h4" />
      <path d="M4.6 3.5h10.8l2.1 8.5v4.5H2.5V12z" />
    </svg>
  ),
  plug: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 2.5v4M13 2.5v4M4.5 6.5h11v3a5.5 5.5 0 0 1-11 0z" />
      <path d="M10 15v2.5" />
    </svg>
  ),
}

/* ---------- 로딩 ---------- */
export function Spinner({ size = 18 }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".18" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- 버튼 ---------- */
export function Button({
  children,
  variant = 'solid',
  size,
  loading = false,
  block = false,
  className = '',
  ...props
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner size={15} />}
      {children}
    </button>
  )
}

/* ---------- 입력 ---------- */
export const Input = forwardRef(function Input(
  { label, hint, error, required, className = '', ...props },
  ref
) {
  return (
    <label className="field">
      {label && (
        <span className="field__label">
          {label}
          {required && <span> *</span>}
        </span>
      )}
      <input ref={ref} className={`input ${className}`} {...props} />
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </label>
  )
})

/* ---------- 태그 ---------- */
export function Tag({ children, tone }) {
  return <span className={`tag ${tone ? `tag--${tone}` : ''}`}>{children}</span>
}

/* ---------- 진행률 ---------- */
export function Meter({ value, onDark = false }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={`meter ${onDark ? 'meter--onDark' : ''}`}>
      <div className="meter__fill" style={{ width: `${v}%` }} />
    </div>
  )
}

/* ---------- 빈 상태 ---------- */
export function Empty({ icon = 'inbox', title, desc }) {
  const Mark = Icon[icon] || Icon.inbox
  return (
    <div className="empty">
      <div className="empty__mark">
        <Mark />
      </div>
      <p className="empty__title">{title}</p>
      {desc && <p className="empty__desc">{desc}</p>}
    </div>
  )
}

/* ---------- 모달 ---------- */
export function Modal({ open, onClose, title, children, wide = false }) {
  // onClose 는 렌더마다 새로 만들어지므로 ref 에 담아두고,
  // 효과는 open 이 바뀔 때만 실행되게 합니다.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal__veil" onClick={onClose} />
      <div className={`modal__panel ${wide ? 'modal__panel--wide' : ''}`}>
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <Icon.close />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
