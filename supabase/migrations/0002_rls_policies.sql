-- ============================================================================
-- YUG Attendance — Row Level Security ポリシー
-- 4階層権限: master / store / admin / employee
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ヘルパー関数: 現在ログインユーザーの users 行情報を取得
-- ---------------------------------------------------------------------------
create or replace function auth_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function auth_user_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.users where id = auth.uid()
$$;

create or replace function auth_user_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from public.users where id = auth.uid()
$$;

create or replace function auth_user_department_id() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.users where id = auth.uid()
$$;

create or replace function is_master() returns boolean
language sql stable as $$ select auth_user_role() = 'master' $$;

create or replace function is_store_or_above() returns boolean
language sql stable as $$ select auth_user_role() in ('master', 'store') $$;

create or replace function is_admin_or_above() returns boolean
language sql stable as $$ select auth_user_role() in ('master', 'store', 'admin') $$;

-- ---------------------------------------------------------------------------
-- 全テーブル RLS 有効化
-- ---------------------------------------------------------------------------
alter table companies            enable row level security;
alter table stores               enable row level security;
alter table departments          enable row level security;
alter table users                enable row level security;
alter table attendances          enable row level security;
alter table breaks               enable row level security;
alter table work_time_calculations enable row level security;
alter table paid_leaves          enable row level security;
alter table shift_patterns       enable row level security;
alter table shifts               enable row level security;
alter table shift_requests       enable row level security;
alter table shift_swaps          enable row level security;
alter table annual_calendars     enable row level security;
alter table calendar_days        enable row level security;
alter table notifications_log    enable row level security;
alter table audit_logs           enable row level security;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy companies_select on companies for select using (
  is_master() or id = auth_user_company_id()
);
create policy companies_modify on companies for all using (is_master()) with check (is_master());

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
create policy stores_select on stores for select using (
  is_master() or company_id = auth_user_company_id()
);
create policy stores_modify on stores for all using (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
) with check (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create policy departments_select on departments for select using (
  is_master() or store_id = auth_user_store_id() or
  exists (select 1 from stores s where s.id = departments.store_id and s.company_id = auth_user_company_id())
);
create policy departments_modify on departments for all using (is_store_or_above())
  with check (is_store_or_above());

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_select on users for select using (
  is_master()
  or id = auth.uid()
  or (is_store_or_above() and company_id = auth_user_company_id())
  or (auth_user_role() = 'admin' and department_id = auth_user_department_id())
);
create policy users_insert on users for insert with check (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
);
create policy users_update on users for update using (
  is_master()
  or id = auth.uid()  -- 本人は自分のプロフィール更新可
  or (is_store_or_above() and company_id = auth_user_company_id())
) with check (
  is_master() or id = auth.uid() or (is_store_or_above() and company_id = auth_user_company_id())
);
create policy users_delete on users for delete using (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
);

-- ---------------------------------------------------------------------------
-- attendances
-- ---------------------------------------------------------------------------
create policy attendances_select on attendances for select using (
  is_master()
  or user_id = auth.uid()
  or (is_store_or_above() and store_id in (select id from stores where company_id = auth_user_company_id()))
  or (auth_user_role() = 'admin' and exists (
        select 1 from users u where u.id = attendances.user_id and u.department_id = auth_user_department_id()))
);
create policy attendances_insert on attendances for insert with check (
  is_master() or user_id = auth.uid() or is_admin_or_above()
);
create policy attendances_update on attendances for update using (
  is_master() or user_id = auth.uid() or is_admin_or_above()
) with check (is_master() or user_id = auth.uid() or is_admin_or_above());
create policy attendances_delete on attendances for delete using (is_store_or_above());

-- ---------------------------------------------------------------------------
-- breaks — attendances と同等の権限
-- ---------------------------------------------------------------------------
create policy breaks_all on breaks for all using (
  exists (select 1 from attendances a where a.id = breaks.attendance_id and (
    is_master() or a.user_id = auth.uid() or is_admin_or_above()
  ))
);

-- ---------------------------------------------------------------------------
-- work_time_calculations
-- ---------------------------------------------------------------------------
create policy wtc_select on work_time_calculations for select using (
  exists (select 1 from attendances a where a.id = work_time_calculations.attendance_id and (
    is_master() or a.user_id = auth.uid() or is_admin_or_above()
  ))
);
create policy wtc_modify on work_time_calculations for all using (is_admin_or_above())
  with check (is_admin_or_above());

-- ---------------------------------------------------------------------------
-- paid_leaves
-- ---------------------------------------------------------------------------
create policy paid_leaves_select on paid_leaves for select using (
  is_master() or user_id = auth.uid() or is_admin_or_above()
);
create policy paid_leaves_insert on paid_leaves for insert with check (
  user_id = auth.uid() or is_admin_or_above()
);
create policy paid_leaves_update on paid_leaves for update using (
  is_admin_or_above() or (user_id = auth.uid() and status = 'pending')
) with check (
  is_admin_or_above() or (user_id = auth.uid() and status = 'pending')
);
create policy paid_leaves_delete on paid_leaves for delete using (is_admin_or_above());

-- ---------------------------------------------------------------------------
-- shift_patterns
-- ---------------------------------------------------------------------------
create policy shift_patterns_select on shift_patterns for select using (
  is_master() or exists (select 1 from stores s where s.id = shift_patterns.store_id and s.company_id = auth_user_company_id())
);
create policy shift_patterns_modify on shift_patterns for all using (is_store_or_above())
  with check (is_store_or_above());

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
create policy shifts_select on shifts for select using (
  is_master() or user_id = auth.uid() or is_admin_or_above()
);
create policy shifts_modify on shifts for all using (is_store_or_above())
  with check (is_store_or_above());

-- ---------------------------------------------------------------------------
-- shift_requests
-- ---------------------------------------------------------------------------
create policy shift_requests_select on shift_requests for select using (
  is_master() or user_id = auth.uid() or is_admin_or_above()
);
create policy shift_requests_insert on shift_requests for insert with check (
  user_id = auth.uid() or is_admin_or_above()
);
create policy shift_requests_update on shift_requests for update using (
  user_id = auth.uid() or is_admin_or_above()
) with check (user_id = auth.uid() or is_admin_or_above());
create policy shift_requests_delete on shift_requests for delete using (
  user_id = auth.uid() or is_admin_or_above()
);

-- ---------------------------------------------------------------------------
-- shift_swaps
-- ---------------------------------------------------------------------------
create policy shift_swaps_select on shift_swaps for select using (
  is_master() or from_user_id = auth.uid() or to_user_id = auth.uid() or is_admin_or_above()
);
create policy shift_swaps_insert on shift_swaps for insert with check (
  from_user_id = auth.uid() or is_admin_or_above()
);
create policy shift_swaps_update on shift_swaps for update using (
  from_user_id = auth.uid() or to_user_id = auth.uid() or is_admin_or_above()
) with check (
  from_user_id = auth.uid() or to_user_id = auth.uid() or is_admin_or_above()
);

-- ---------------------------------------------------------------------------
-- annual_calendars / calendar_days
-- ---------------------------------------------------------------------------
create policy annual_calendars_select on annual_calendars for select using (
  is_master() or exists (select 1 from stores s where s.id = annual_calendars.store_id and s.company_id = auth_user_company_id())
);
create policy annual_calendars_modify on annual_calendars for all using (is_store_or_above())
  with check (is_store_or_above());

create policy calendar_days_select on calendar_days for select using (
  exists (
    select 1 from annual_calendars ac
    join stores s on s.id = ac.store_id
    where ac.id = calendar_days.calendar_id and (is_master() or s.company_id = auth_user_company_id())
  )
);
create policy calendar_days_modify on calendar_days for all using (is_store_or_above())
  with check (is_store_or_above());

-- ---------------------------------------------------------------------------
-- notifications_log
-- ---------------------------------------------------------------------------
create policy notifications_log_select on notifications_log for select using (
  is_master() or user_id = auth.uid() or is_admin_or_above()
);
create policy notifications_log_insert on notifications_log for insert with check (true);

-- ---------------------------------------------------------------------------
-- audit_logs — 全員 read-only / master のみ insert（実体は service_role）
-- ---------------------------------------------------------------------------
create policy audit_logs_select on audit_logs for select using (is_admin_or_above());
-- insert は通常 service_role で行うため policy 不要（RLS 有効でも service_role はバイパス）
