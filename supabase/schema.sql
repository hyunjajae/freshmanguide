-- ============================================================================
--  팀빌딩 접수 사이트 — 데이터베이스 스키마
--  ----------------------------------------------------------------------
--  사용법: Supabase 대시보드 → 왼쪽 메뉴 SQL Editor → New query →
--          이 파일 전체를 복사해서 붙여넣고 [Run] 을 누르면 끝입니다.
--          여러 번 실행해도 안전하며, 참가자 명단과 접수 기록은 지워지지 않습니다.
-- ============================================================================


-- ============================================================================
--  1. 테이블
-- ============================================================================

-- 1-1. 설정값 (LC 개수, 행사 이름 등 — 코드를 안 고치고 여기서 바꿉니다)
create table if not exists settings (
  key   text primary key,
  value text not null
);

insert into settings (key, value) values
  ('event_name', '팀빌딩 접수'),
  ('lc_per_day', '31'),   -- 하루에 몇 개 LC를 진행하는지
  ('total_days', '3')     -- 총 며칠짜리 행사인지
on conflict (key) do nothing;


-- 1-2. 참가자(신입생) 명단
--      신입생은 학번이 아직 없으므로 이름 / 연락처 / LC / 계열 만 받습니다.
create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_chosung  text,                    -- 초성 검색용 (ㄱㅎㄱ 으로 김현규 찾기)
  phone         text,                    -- 숫자만 저장 (01012345678)
  lc            int  not null,
  dept          text,                    -- 계열
  checked_in_at timestamptz,             -- NULL 이면 미접수, 값이 있으면 접수 완료
  is_walkin     boolean not null default false,  -- 현장 등록 여부
  created_at    timestamptz not null default now()
);

-- 예전 버전에서 만들어졌던 학번 칸을 정리합니다 (신입생은 학번이 없습니다)
alter table participants drop column if exists student_id;

create index if not exists participants_lc_idx      on participants (lc);
create index if not exists participants_name_idx    on participants (name);
create index if not exists participants_checked_idx on participants (checked_in_at);


-- 1-3. 계정
--      MANAGER : 명단·계정·설정을 관리하는 운영자 (접수처보다 높은 권한)
--      ADMIN   : 접수처 — 참가자 검색과 접수 처리
--      FG      : Freshman Guide — 담당 LC 조회 전용
create table if not exists accounts (
  id         uuid primary key default gen_random_uuid(),
  role       text not null check (role in ('MANAGER', 'ADMIN', 'FG')),
  login_id   text not null,              -- 관리자는 아이디, FG는 성함
  login_key  text not null,              -- 관리자는 비밀번호, FG는 학번
  lcs        int[] not null default '{}',-- FG가 담당하는 LC 번호 목록
  created_at timestamptz not null default now()
);

-- 예전 버전에는 MANAGER 가 없었으므로 제약 조건을 새로 걸어줍니다
alter table accounts drop constraint if exists accounts_role_check;
alter table accounts add  constraint accounts_role_check
  check (role in ('MANAGER', 'ADMIN', 'FG'));

create unique index if not exists accounts_role_id_idx
  on accounts (role, lower(btrim(login_id)));


-- 1-4. 로그인 세션 (새로고침해도 로그인이 유지되는 이유)
create table if not exists sessions (
  token      uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '18 hours')
);

create index if not exists sessions_expires_idx on sessions (expires_at);


-- ============================================================================
--  2. 보안 (RLS)
--  아무도 테이블에 직접 접근하지 못하게 잠급니다.
--  모든 조회/수정은 아래 4번의 함수를 통해서만 가능합니다.
--  → FG가 브라우저 개발자도구를 열어도 남의 LC 데이터를 볼 수 없습니다.
-- ============================================================================

alter table settings     enable row level security;
alter table participants enable row level security;
alter table accounts     enable row level security;
alter table sessions     enable row level security;
-- 정책(policy)을 하나도 만들지 않았으므로 = 외부에서 직접 접근 전면 차단


-- ============================================================================
--  3. 함수 서명이 바뀐 것 정리
--  (인자가 달라지면 예전 함수가 남아 "어느 걸 부를지 모르겠다" 오류가 납니다)
-- ============================================================================

-- 예전 app_auth 는 두 번째 인자가 boolean 이었습니다.
-- 지우지 않으면 app_auth(토큰) 을 부를 때 "어느 함수인지 모르겠다" 오류가 납니다.
drop function if exists app_auth(uuid, boolean);

drop function if exists app_add_walkin(uuid, text, text, int, text, boolean, text);
drop function if exists app_add_walkin(uuid, text, text, int, text, boolean);


-- ============================================================================
--  4. 함수 (사이트가 호출하는 API)
-- ============================================================================

-- 4-0. 공개 설정값 조회 (로그인 전에도 행사 이름을 보여주기 위해)
create or replace function app_settings()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_object_agg(key, value), '{}'::json) from settings;
$$;


-- 4-1. 내부용: 세션 토큰 검증
--      p_min_role 로 필요한 권한을 지정합니다.
--        'FG'      → 로그인만 되어 있으면 통과
--        'ADMIN'   → 접수처 또는 운영자
--        'MANAGER' → 운영자만
create or replace function app_auth(p_token uuid, p_min_role text default 'FG')
returns accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc accounts%rowtype;
  v_ok  boolean;
begin
  select a.* into v_acc
    from sessions s
    join accounts a on a.id = s.account_id
   where s.token = p_token
     and s.expires_at > now();

  if not found then
    raise exception 'SESSION_EXPIRED';
  end if;

  v_ok := case p_min_role
            when 'MANAGER' then v_acc.role = 'MANAGER'
            when 'ADMIN'   then v_acc.role in ('MANAGER', 'ADMIN')
            else true
          end;

  if not v_ok then
    raise exception 'FORBIDDEN';
  end if;

  return v_acc;
end;
$$;


-- 4-2. 로그인
create or replace function app_login(p_role text, p_id text, p_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc   accounts%rowtype;
  v_token uuid;
begin
  select * into v_acc
    from accounts
   where role = p_role
     and lower(btrim(login_id)) = lower(btrim(p_id))
     and btrim(login_key)       = btrim(p_key)
   limit 1;

  -- 실패 시 "아이디가 없다 / 비번이 틀렸다"를 구분해주지 않습니다 (계정 추측 방지)
  if not found then
    return json_build_object('ok', false, 'message', '정보가 일치하지 않습니다. 다시 확인해주세요.');
  end if;

  delete from sessions where expires_at < now();  -- 만료 세션 청소

  insert into sessions (account_id) values (v_acc.id) returning token into v_token;

  return json_build_object(
    'ok',    true,
    'token', v_token,
    'role',  v_acc.role,
    'name',  v_acc.login_id,
    'lcs',   v_acc.lcs
  );
end;
$$;


-- 4-3. 로그아웃
create or replace function app_logout(p_token uuid)
returns json
language sql
security definer
set search_path = public
as $$
  with d as (delete from sessions where token = p_token returning 1)
  select json_build_object('ok', true);
$$;


-- 4-4. 명단 조회
--      접수처·운영자 → 전체
--      FG           → 담당 LC 인원만 (그 안에서는 연락처를 전부 볼 수 있습니다)
create or replace function app_roster(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc    accounts%rowtype;
  v_result json;
begin
  v_acc := app_auth(p_token);

  if v_acc.role in ('MANAGER', 'ADMIN') then
    select coalesce(json_agg(t order by t.lc, t.name), '[]'::json) into v_result
      from (
        select id, name, phone, lc, dept, checked_in_at, is_walkin
          from participants
      ) t;
  else
    -- 담당하지 않는 LC의 데이터는 서버를 떠나지 않습니다
    select coalesce(json_agg(t order by t.lc, t.name), '[]'::json) into v_result
      from (
        select id, name, phone, lc, dept, checked_in_at, is_walkin
          from participants
         where lc = any(v_acc.lcs)
      ) t;
  end if;

  return v_result;
end;
$$;


-- 4-5. 접수 처리 (접수처 이상)
create or replace function app_check_in(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants%rowtype;
begin
  perform app_auth(p_token, 'ADMIN');

  -- 아직 미접수인 경우에만 업데이트 → 두 창구에서 동시에 눌러도 안전
  update participants
     set checked_in_at = now()
   where id = p_id
     and checked_in_at is null
  returning * into v_row;

  if not found then
    select * into v_row from participants where id = p_id;
    if not found then
      return json_build_object('ok', false, 'message', '참가자를 찾을 수 없습니다.');
    end if;
    return json_build_object(
      'ok', false, 'already', true,
      'message', v_row.name || '님은 이미 접수되었습니다.',
      'participant', to_json(v_row)
    );
  end if;

  return json_build_object('ok', true, 'participant', to_json(v_row));
end;
$$;


-- 4-6. 접수 취소 (접수처 이상)
create or replace function app_undo_check_in(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants%rowtype;
begin
  perform app_auth(p_token, 'ADMIN');

  update participants
     set checked_in_at = null
   where id = p_id
  returning * into v_row;

  if not found then
    return json_build_object('ok', false, 'message', '참가자를 찾을 수 없습니다.');
  end if;

  return json_build_object('ok', true, 'participant', to_json(v_row));
end;
$$;


-- 4-7. 현장 등록 (명단에 없는 사람이 왔을 때)
create or replace function app_add_walkin(
  p_token    uuid,
  p_name     text,
  p_phone    text,
  p_lc       int,
  p_dept     text,
  p_check_in boolean default true
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants%rowtype;
begin
  perform app_auth(p_token, 'ADMIN');

  if btrim(coalesce(p_name, '')) = '' then
    return json_build_object('ok', false, 'message', '이름을 입력해주세요.');
  end if;
  if p_lc is null then
    return json_build_object('ok', false, 'message', 'LC 번호를 입력해주세요.');
  end if;

  insert into participants (name, name_chosung, phone, lc, dept, is_walkin, checked_in_at)
  values (
    btrim(p_name),
    null,                                  -- 초성은 클라이언트에서 채워 넣습니다
    nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), ''),
    p_lc,
    nullif(btrim(coalesce(p_dept, '')), ''),
    true,
    case when p_check_in then now() else null end
  )
  returning * into v_row;

  return json_build_object('ok', true, 'participant', to_json(v_row));
end;
$$;


-- 4-8. 통계 (LC별 인원/접수 수 — 개인정보 없음, FG도 조회 가능)
create or replace function app_stats(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  perform app_auth(p_token);

  select coalesce(json_agg(t order by t.lc), '[]'::json) into v_result
    from (
      select lc,
             count(*)::int                                          as total,
             count(*) filter (where checked_in_at is not null)::int  as done
        from participants
       group by lc
    ) t;

  return v_result;
end;
$$;


-- ============================================================================
--  5. 운영자 전용 기능 (MANAGER 권한이 있어야만 호출됩니다)
-- ============================================================================

-- 5-1. 참가자 명단 업로드
--      p_replace = true 면 기존 명단을 전부 지우고 새로 넣습니다.
create or replace function app_upload_participants(
  p_token   uuid,
  p_rows    jsonb,
  p_replace boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform app_auth(p_token, 'MANAGER');

  if p_replace then
    delete from participants;
  end if;

  insert into participants (name, name_chosung, phone, lc, dept)
  select btrim(r->>'name'),
         nullif(r->>'chosung', ''),
         nullif(r->>'phone', ''),
         (r->>'lc')::int,
         nullif(r->>'dept', '')
    from jsonb_array_elements(p_rows) r
   where btrim(coalesce(r->>'name', '')) <> ''
     and (r->>'lc') ~ '^[0-9]+$';

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'inserted', v_count);
end;
$$;


-- 5-2. FG 계정 업로드 — 접수처·운영자 계정은 건드리지 않습니다
create or replace function app_upload_fg_accounts(
  p_token   uuid,
  p_rows    jsonb,
  p_replace boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform app_auth(p_token, 'MANAGER');

  if p_replace then
    delete from accounts where role = 'FG';
  end if;

  insert into accounts (role, login_id, login_key, lcs)
  select 'FG',
         btrim(r->>'login_id'),
         btrim(r->>'login_key'),
         coalesce(
           (select array_agg(x::int)
              from jsonb_array_elements_text(r->'lcs') x
             where x ~ '^[0-9]+$'),
           '{}'::int[]
         )
    from jsonb_array_elements(p_rows) r
   where btrim(coalesce(r->>'login_id', ''))  <> ''
     and btrim(coalesce(r->>'login_key', '')) <> ''
  on conflict (role, lower(btrim(login_id))) do update
    set login_key = excluded.login_key,
        lcs       = excluded.lcs;

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'saved', v_count);
end;
$$;


-- 5-3. 계정 목록 조회 — 비밀번호는 내려주지 않습니다
create or replace function app_list_accounts(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  perform app_auth(p_token, 'MANAGER');

  select coalesce(json_agg(t order by t.role, t.login_id), '[]'::json) into v_result
    from (select id, role, login_id, lcs from accounts) t;

  return v_result;
end;
$$;


-- 5-4. 계정 추가/수정
create or replace function app_upsert_account(
  p_token uuid,
  p_role  text,
  p_id    text,
  p_key   text,
  p_lcs   int[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_auth(p_token, 'MANAGER');

  if p_role not in ('MANAGER', 'ADMIN', 'FG') then
    return json_build_object('ok', false, 'message', '역할이 올바르지 않습니다.');
  end if;
  if btrim(coalesce(p_id, '')) = '' or btrim(coalesce(p_key, '')) = '' then
    return json_build_object('ok', false, 'message', '아이디와 비밀번호를 모두 입력해주세요.');
  end if;

  insert into accounts (role, login_id, login_key, lcs)
  values (p_role, btrim(p_id), btrim(p_key), coalesce(p_lcs, '{}'))
  on conflict (role, lower(btrim(login_id))) do update
    set login_key = excluded.login_key,
        lcs       = excluded.lcs;

  return json_build_object('ok', true);
end;
$$;


-- 5-5. 계정 삭제 — 마지막 운영자 계정은 삭제할 수 없습니다
create or replace function app_delete_account(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text;
  v_left       int;
begin
  perform app_auth(p_token, 'MANAGER');

  select role into v_role from accounts where id = p_id;
  if not found then
    return json_build_object('ok', false, 'message', '계정을 찾을 수 없습니다.');
  end if;

  if v_role = 'MANAGER' then
    select count(*) into v_left from accounts where role = 'MANAGER';
    if v_left <= 1 then
      return json_build_object('ok', false, 'message', '마지막 운영자 계정은 삭제할 수 없습니다.');
    end if;
  end if;

  delete from accounts where id = p_id;
  return json_build_object('ok', true);
end;
$$;


-- 5-6. 설정 변경
create or replace function app_set_setting(p_token uuid, p_key text, p_value text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_auth(p_token, 'MANAGER');

  insert into settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;

  return json_build_object('ok', true);
end;
$$;


-- ============================================================================
--  6. 기본 계정
--
--  ⚠️ 이 파일은 GitHub에 올라갑니다. 진짜 비밀번호를 여기에 적지 마세요.
--     아래는 임시 비밀번호이고, 실제 비밀번호는 이 파일을 실행한 뒤
--     Supabase SQL Editor 에서 따로 한 줄만 실행해서 바꿉니다. (README 1-5 참고)
--
--       update accounts set login_key = '진짜비밀번호'
--        where role = 'MANAGER' and login_id = 'freshmanguide';
--
--     또는 사이트의 관리 화면 → 계정 탭에서 바꿔도 됩니다.
-- ============================================================================

-- 운영자 (명단 업로드 · 계정 관리 · 설정)
insert into accounts (role, login_id, login_key)
values ('MANAGER', 'freshmanguide', 'CHANGE-ME-FIRST')
on conflict (role, lower(btrim(login_id))) do nothing;

-- 접수처 (현장에서 접수만)
insert into accounts (role, login_id, login_key)
values ('ADMIN', 'admin', 'CHANGE-ME-TOO')
on conflict (role, lower(btrim(login_id))) do nothing;


-- ============================================================================
--  완료!
-- ============================================================================
