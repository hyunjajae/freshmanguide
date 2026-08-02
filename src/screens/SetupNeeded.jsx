// .env.local 을 아직 안 만들었을 때 보여주는 안내 화면
// (설정을 빼먹으면 흰 화면만 나와서 뭐가 문제인지 알 수 없기 때문에 만들었습니다)

export default function SetupNeeded() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-5">
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl">
        <div className="mb-4 text-4xl">🔌</div>
        <h1 className="text-xl font-bold text-slate-900">Supabase 연결 설정이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-600">
          아직 데이터베이스 주소가 입력되지 않았습니다. 아래 순서대로 진행해주세요.
        </p>

        <ol className="mt-5 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              1
            </span>
            <span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 underline"
              >
                supabase.com/dashboard
              </a>
              에서 새 프로젝트를 만듭니다.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              2
            </span>
            <span>
              왼쪽 메뉴 <b>SQL Editor</b> 에서 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">supabase/schema.sql</code>{' '}
              파일 내용을 붙여넣고 실행합니다.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              3
            </span>
            <span>
              <b>Project Settings → API</b> 에서 URL 과 anon key 를 복사합니다.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              4
            </span>
            <span>
              프로젝트 폴더의 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code> 을{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.local</code> 로 복사하고 값을 채웁니다.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              5
            </span>
            <span>
              터미널에서 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run dev</code> 를 다시 실행합니다.
              <span className="mt-1 block text-xs text-slate-500">
                (.env 파일은 서버를 껐다 켜야 반영됩니다)
              </span>
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}
