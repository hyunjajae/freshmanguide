// 화면 아래에 잠깐 떴다 사라지는 알림
// alert() 은 누를 때까지 화면을 막아버려서 접수 속도를 떨어뜨리므로 쓰지 않습니다.

import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const showToast = useCallback((message, type = 'info', duration = 2600) => {
    const id = ++idRef.current
    setToasts((list) => [...list, { id, message, type }])
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const styles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    warn: 'bg-amber-500 text-white',
    info: 'bg-slate-900 text-white',
  }

  const icons = { success: '✓', error: '!', warn: '!', info: 'i' }

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-up flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3
                        text-sm font-semibold shadow-xl ${styles[t.type] || styles.info}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs">
              {icons[t.type] || icons.info}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
