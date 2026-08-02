-- ============================================================================
--  2026 팀빌딩 접수 사이트 — 데이터베이스 스키마
--  ----------------------------------------------------------------------
--  사용법: Supabase 대시보드 → 왼쪽 메뉴 SQL Editor → New query →
--          이 파일 전체를 복사해서 붙여넣고 [Run] 을 누르면 끝입니다.
--          (여러 번 실행해도 안전하도록 만들어져 있습니다)
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
  ('event_name', '2026 팀빌딩 접수'),
  ('lc_per_day', '31'),   -- 하루에 몇 개 LC를 진행하는지
  ('total_days', '3')     -- 총 며칠짜리 행사인지
on conflict (key) do nothing;


-- 1-2. 참가자 명단
create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_chosung  text,                    -- 초성 검색용 (ㄱㅎㄱ 으로 김현규 찾기)
  phone         text,                    -- 숫자만 저장 (01012345678)
  student_id    text,                    -- 학번
  lc            int  not null,
  dept          text,                    -- 계열
  checked_in_at timestamptz,             -- NULL 이면 미접수, 값이 있으면 접수 완료
  is_walkin     boolean not null default false,  -- 현장 등록 여부
  created_at    timestamptz not null default now()
);

-- 이미 만들어진 데이터베이스에 나중에 추가된 항목을 채워 넣습니다.
-- (이 파일을 다시 실행해도 기존 데이터는 지워지지 않습니다)
alter table participants add column if not exists student_id text;

create index if not exists participants_lc_idx      on participants (lc);
create index if not exists participants_name_idx    on participants (name);
create index if not exists participants_checked_idx on participants (checked_in_at);


-- 1-3. 계정 (접수처 관리자 + 진행 FG)
create table if not exists accounts (
  id         uuid primary key default gen_random_uuid(),
  role       text not null check (role in ('ADMIN', 'FG')),
  login_id   text not null,              -- 관리자는 아이디, FG는 성함
  login_key  text not null,              -- 관리자는 비밀번호, FG는 학번
  lcs        int[] not null default '{}',-- FG가 담당하는 LC 번호 목록
  created_at timestamptz not null default now()
);

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
--  모든 조회/수정은 아래 3번의 함수를 통해서만 가능합니다.
--  → FG가 브라우저 개발자도구를 열어도 남의 LC 데이터를 볼 수 없습니다.
-- ============================================================================

alter table settings     enable row level security;
alter table participants enable row level security;
alter table accounts     enable row level security;
alter table sessions     enable row level security;
-- 정책(policy)을 하나도 만들지 않았으므로 = 외부에서 직접 접근 전면 차단


-- ============================================================================
--  3. 함수 (사이트가 호출하는 API)
-- ============================================================================

-- 3-0. 공개 설정값 조회 (로그인 전에도 행사 이름을 보여주기 위해)
create or replace function app_settings()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_object_agg(key, value), '{}'::json) from settings;
$$;


-- 3-1. 내부용: 세션 토큰 검증
create or replace function app_auth(p_token uuid, p_require_admin boolean default false)
returns accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc accounts%rowtype;
begin
  select a.* into v_acc
    from sessions s
    join accounts a on a.id = s.account_id
   where s.token = p_token
     and s.expires_at > now();

  if not found then
    raise exception 'SESSION_EXPIRED';
  end if;

  if p_require_admin and v_acc.role <> 'ADMIN' then
    raise exception 'FORBIDDEN';
  end if;

  return v_acc;
end;
$$;


-- 3-2. 로그인
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


-- 3-3. 로그아웃
create or replace function app_logout(p_token uuid)
returns json
language sql
security definer
set search_path = public
as $$
  with d as (delete from sessions where token = p_token returning 1)
  select json_build_object('ok', true);
$$;


-- 3-4. 명단 조회
--      관리자 → 전체
--      FG     → 담당 LC 인원만 (그 안에서는 연락처·학번을 전부 볼 수 있습니다)
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

  if v_acc.role = 'ADMIN' then
    select coalesce(json_agg(t order by t.lc, t.name), '[]'::json) into v_result
      from (
        select id, name, phone, student_id, lc, dept, checked_in_at, is_walkin
          from participants
      ) t;
  else
    -- FG에게는 담당 LC에 속한 인원만 내려갑니다. 다른 LC 데이터는 서버를 떠나지 않습니다.
    select coalesce(json_agg(t order by t.lc, t.name), '[]'::json) into v_result
      from (
        select id, name, phone, student_id, lc, dept, checked_in_at, is_walkin
          from participants
         where lc = any(v_acc.lcs)
      ) t;
  end if;

  return v_result;
end;
$$;


-- 3-5. 접수 처리 (관리자 전용)
create or replace function app_check_in(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants%rowtype;
begin
  perform app_auth(p_token, true);

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


-- 3-6. 접수 취소 (관리자 전용)
create or replace function app_undo_check_in(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants%rowtype;
begin
  perform app_auth(p_token, true);

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


-- 3-7. 현장 등록 (명단에 없는 사람이 왔을 때)
create or replace function app_add_walkin(
  p_token      uuid,
  p_name       text,
  p_phone      text,
  p_lc         int,
  p_dept       text,
  p_check_in   boolean default true,
  p_student_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants%rowtype;
begin
  perform app_auth(p_token, true);

  if btrim(coalesce(p_name, '')) = '' then
    return json_build_object('ok', false, 'message', '이름을 입력해주세요.');
  end if;
  if p_lc is null then
    return json_build_object('ok', false, 'message', 'LC 번호를 입력해주세요.');
  end if;

  insert into participants (name, name_chosung, phone, student_id, lc, dept, is_walkin, checked_in_at)
  values (
    btrim(p_name),
    null,                                  -- 초성은 클라이언트에서 채워 넣습니다
    nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), ''),
    nullif(btrim(coalesce(p_student_id, '')), ''),
    p_lc,
    nullif(btrim(coalesce(p_dept, '')), ''),
    true,
    case when p_check_in then now() else null end
  )
  returning * into v_row;

  return json_build_object('ok', true, 'participant', to_json(v_row));
end;
$$;


-- 3-8. 통계 (LC별 인원/접수 수 — 개인정보 없음, FG도 조회 가능)
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


-- 3-9. 참가자 명단 업로드 (관리자 전용)
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
  perform app_auth(p_token, true);

  if p_replace then
    delete from participants;
  end if;

  insert into participants (name, name_chosung, phone, student_id, lc, dept)
  select btrim(r->>'name'),
         nullif(r->>'chosung', ''),
         nullif(r->>'phone', ''),
         nullif(r->>'studentId', ''),
         (r->>'lc')::int,
         nullif(r->>'dept', '')
    from jsonb_array_elements(p_rows) r
   where btrim(coalesce(r->>'name', '')) <> ''
     and (r->>'lc') ~ '^[0-9]+$';

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'inserted', v_count);
end;
$$;


-- 3-10. FG 계정 업로드 (관리자 전용) — 관리자 계정은 건드리지 않습니다
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
  perform app_auth(p_token, true);

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


-- 3-11. 계정 목록 조회 (관리자 전용) — 비밀번호는 내려주지 않습니다
create or replace function app_list_accounts(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  perform app_auth(p_token, true);

  select coalesce(json_agg(t order by t.role, t.login_id), '[]'::json) into v_result
    from (select id, role, login_id, lcs from accounts) t;

  return v_result;
end;
$$;


-- 3-12. 계정 추가/수정 (관리자 전용)
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
  perform app_auth(p_token, true);

  if p_role not in ('ADMIN', 'FG') then
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


-- 3-13. 계정 삭제 (관리자 전용) — 마지막 관리자 계정은 삭제 불가
create or replace function app_delete_account(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text;
  v_admin_left int;
begin
  perform app_auth(p_token, true);

  select role into v_role from accounts where id = p_id;
  if not found then
    return json_build_object('ok', false, 'message', '계정을 찾을 수 없습니다.');
  end if;

  if v_role = 'ADMIN' then
    select count(*) into v_admin_left from accounts where role = 'ADMIN';
    if v_admin_left <= 1 then
      return json_build_object('ok', false, 'message', '마지막 관리자 계정은 삭제할 수 없습니다.');
    end if;
  end if;

  delete from accounts where id = p_id;
  return json_build_object('ok', true);
end;
$$;


-- 3-14. 설정 변경 (관리자 전용)
create or replace function app_set_setting(p_token uuid, p_key text, p_value text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_auth(p_token, true);

  insert into settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;

  return json_build_object('ok', true);
end;
$$;


-- ============================================================================
--  4. 최초 관리자 계정
--  ⚠️ 아래 비밀번호는 반드시 바꾸세요! (로그인 후 '명단 관리' 화면에서 변경 가능)
-- ============================================================================

insert into accounts (role, login_id, login_key)
values ('ADMIN', 'admin', 'changeme1234')
on conflict do nothing;


-- ============================================================================
--  완료!  이제 .env.local 에 프로젝트 URL 과 anon key 를 넣으면 됩니다.
-- ============================================================================
