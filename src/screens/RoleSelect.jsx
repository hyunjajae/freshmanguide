// 첫 화면 — 접수처 / FG 중에 고릅니다.

export default function RoleSelect({ settings, onSelect }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-4 text-5xl">🎪</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {settings.event_name || '팀빌딩 접수'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">역할을 선택해주세요</p>
        </div>

        <div className="space-y-3">
          <RoleCard
            emoji="📍"
            title="접수처"
            description="참가자를 검색하고 접수를 처리합니다"
            accent="bg-slate-900"
            onClick={() => onSelect('ADMIN')}
          />
          <RoleCard
            emoji="🚶"
            title="진행 FG"
            description="담당 LC의 접수 현황을 실시간으로 확인합니다"
            accent="bg-blue-600"
            onClick={() => onSelect('FG')}
          />
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          made by 명륜 18기 회장 김현규
        </p>
      </div>
    </div>
  )
}

function RoleCard({ emoji, title, description, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left
                 shadow-sm ring-1 ring-slate-900/5 transition
                 hover:shadow-lg active:scale-[0.99]"
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${accent}`}
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900">{title}</div>
        <div className="mt-0.5 text-sm text-slate-500">{description}</div>
      </div>
      <svg
        className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}
