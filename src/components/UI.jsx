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
  settings: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.2v2M10 15.8v2M17.8 10h-2M4.2 10h-2M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4M15.5 15.5l-1.4-1.4M5.9 5.9 4.5 4.5" />
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
