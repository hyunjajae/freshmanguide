// .env.local 을 아직 안 만들었을 때 보여주는 안내 화면
// (설정을 빼먹으면 흰 화면만 나와서 뭐가 문제인지 알 수 없기 때문에 만들었습니다)

import { Icon } from '../components/UI'

const STEPS = [
  <>
    <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
      supabase.com/dashboard
    </a>
    에서 새 프로젝트를 만듭니다.
  </>,
  <>
    왼쪽 메뉴 <b>SQL Editor</b> 에서 <span className="kbd">supabase/schema.sql</span> 파일 내용을
    붙여넣고 실행합니다.
  </>,
  <>
    <b>Project Settings → API</b> 에서 Project URL 과 anon key 를 복사합니다.
  </>,
  <>
    프로젝트 폴더의 <span className="kbd">.env.example</span> 을{' '}
    <span className="kbd">.env.local</span> 로 복사하고 값을 채웁니다.
  </>,
  <>
    터미널에서 <span className="kbd">npm run dev</span> 를 다시 실행합니다. (.env 파일은 서버를 껐다
    켜야 반영됩니다)
  </>,
]

export default function SetupNeeded() {
  return (
    <div className="app rise">
      <div className="wrap wrap--narrow" style={{ paddingTop: 72, paddingBottom: 60 }}>
        <div className="empty__mark" style={{ margin: '0 0 22px' }}>
          <Icon.plug />
        </div>

        <p className="eyebrow">Setup</p>
        <h1 className="title title--sm">Supabase 연결 설정이 필요합니다</h1>
        <p className="sub">아직 데이터베이스 주소가 입력되지 않았습니다.</p>

        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={i}>
              <span className="steps__no">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
