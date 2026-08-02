// 여러 화면에서 공통으로 쓰는 작은 부품들

import { forwardRef, useEffect } from 'react'

/** 로딩 스피너 */
export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  )
}

/** 버튼 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
    'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400'

  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    blue: 'bg-blue-600 text-white hover:bg-blue-700',
    green: 'bg-emerald-600 text-white hover:bg-emerald-700',
    red: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }

  // 손가락으로 누르는 화면이라 버튼을 넉넉하게 잡았습니다 (최소 44px 높이 권장)
  const sizes = {
    sm: 'px-4 py-2.5 text-[15px]',
    md: 'px-5 py-3.5 text-[17px]',
    lg: 'px-6 py-4 text-lg',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

/** 입력창 (부모가 focus() 를 걸 수 있도록 ref 를 전달받습니다) */
export const Input = forwardRef(function Input({ label, hint, className = '', ...props }, ref) {
  return (
    <label className="block">
      {label && (
        <span className="mb-2 block text-[15px] font-semibold text-slate-700">{label}</span>
      )}
      <input
        ref={ref}
        // 글자 크기를 16px 미만으로 하면 아이폰에서 입력할 때 화면이 확대됩니다
        className={
          'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[17px] ' +
          'placeholder:text-slate-400 focus:border-slate-900 focus:outline-none ' +
          'focus:ring-2 focus:ring-slate-900/10 ' +
          className
        }
        {...props}
      />
      {hint && <span className="mt-1.5 block text-[13px] text-slate-500">{hint}</span>}
    </label>
  )
})

/** 진행률 막대 */
export function ProgressBar({ value, className = '' }) {
  const v = Math.max(0, Math.min(100, value))
  const color = v >= 100 ? 'bg-emerald-500' : v >= 60 ? 'bg-blue-500' : 'bg-amber-500'
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

/** 모달 (팝업 창) */
export function Modal({ open, onClose, title, children, wide = false }) {
  // 모달이 열려 있을 때 뒤쪽 화면이 스크롤되지 않도록
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`animate-slide-up relative flex max-h-[90vh] w-full flex-col overflow-hidden
                    rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl
                    ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/** 비어 있을 때 보여주는 안내 */
export function EmptyState({ icon = '📭', title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 text-5xl">{icon}</div>
      <p className="text-lg font-bold text-slate-700">{title}</p>
      {description && <p className="mt-1.5 text-[15px] text-slate-500">{description}</p>}
    </div>
  )
}

/** 작은 상태 뱃지 */
export function Badge({ children, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-semibold ${colors[color]}`}
    >
      {children}
    </span>
  )
}
