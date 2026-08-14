// 첫 화면 — 접수처 / FG 중에 고릅니다.

import { Icon } from '../components/UI'

const ROLES = [
  {
    id: 'ADMIN',
    no: '01',
    title: '접수처',
    desc: '참가자를 찾아 접수를 처리합니다',
  },
  {
    id: 'FG',
    no: '02',
    title: '진행 FG',
    desc: '담당 LC의 접수 현황을 실시간으로 확인합니다',
  },
]

export default function RoleSelect({ settings, onSelect }) {
  return (
    <div className="app rise">
      <div className="wrap wrap--narrow" style={{ paddingTop: 40 }}>
        <header className="hero">
          <img className="hero__logo" src="/logo.png" alt="Freshman Guide" />
          <p className="eyebrow">Freshman Guide</p>
          <h1 className="title">{settings.event_name || '팀빌딩 접수'}</h1>
          <p className="sub">역할을 선택해주세요.</p>
        </header>

        <div className="role-list">
          {ROLES.map((r) => (
            <button key={r.id} className="role-card" onClick={() => onSelect(r.id)}>
              <span className="role-card__no">{r.no}</span>
              <span className="role-card__main" style={{ flex: 1, minWidth: 0 }}>
                <span className="role-card__title" style={{ display: 'block' }}>
                  {r.title}
                </span>
                <span className="role-card__desc" style={{ display: 'block' }}>
                  {r.desc}
                </span>
              </span>
              <span className="role-card__arrow">
                <Icon.chevronRight />
              </span>
            </button>
          ))}
        </div>

        <p
          style={{
            marginTop: 56,
            paddingBottom: 40,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--muted)',
            letterSpacing: '.02em',
          }}
        >
          made by 명륜 18기 회장 김현규
        </p>
      </div>
    </div>
  )
}
