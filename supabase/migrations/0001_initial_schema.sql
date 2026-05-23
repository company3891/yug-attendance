-- ============================================================================
-- YUG Attendance — 初期スキーマ
-- Phase 1: 仕様書 Section 4 の14テーブル + audit_logs + departments
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. companies — 会社
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  name_kana text,
  corporate_number text,
  representative_name text,
  founded_on date,
  industry text,
  employee_scale text,
  zip text,
  prefecture text,
  city text,
  address1 text,
  address2 text,
  phone text,
  contact_email text,
  website_url text,
  logo_url text,
  brand_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. stores — 店舗
-- ---------------------------------------------------------------------------
create table stores (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  store_code text,
  address text,
  phone text,
  open_time time,
  close_time time,
  closed_days int[], -- 0=Sunday .. 6=Saturday
  qr_secret text not null default encode(gen_random_bytes(32), 'hex'),
  settings jsonb not null default '{}'::jsonb,  -- 勤怠ルール・打刻丸め・残業ルール等
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_company_id_idx on stores(company_id);

-- ---------------------------------------------------------------------------
-- 3. departments — 部門（initial-setup-items.md STEP 4-1）
-- ---------------------------------------------------------------------------
create table departments (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index departments_store_id_idx on departments(store_id);

-- ---------------------------------------------------------------------------
-- 4. users — 従業員（Supabase Auth と1:1で連携）
-- ---------------------------------------------------------------------------
create type user_role as enum ('master', 'store', 'admin', 'employee');

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_no text,
  name text not null,
  name_kana text,
  name_en text,
  birthday date,
  gender text,
  phone text,
  emergency_contact jsonb,
  company_id uuid references companies(id) on delete set null,
  store_id uuid references stores(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  role user_role not null default 'employee',
  job_title text,
  employment_type text,  -- 正社員/契約/パート/アルバイト/業務委託
  hire_date date,
  -- 給与
  wage_type text,  -- hourly/monthly/daily
  hourly_wage int,
  monthly_wage int,
  daily_wage int,
  commute_allowance int,
  allowances jsonb default '{}'::jsonb,
  payroll_close_day int,
  payroll_pay_day int,
  bank_account jsonb,  -- 暗号化推奨
  -- 勤怠初期データ
  weekly_workdays int,
  daily_work_minutes int,
  paid_leave_days numeric default 0,
  -- 顔認証・QR
  face_descriptor jsonb,
  -- 通知
  slack_user_id text,
  line_user_id text,
  notification_settings jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_company_id_idx on users(company_id);
create index users_store_id_idx on users(store_id);
create index users_department_id_idx on users(department_id);
create unique index users_employee_no_company_idx on users(company_id, employee_no) where employee_no is not null;

-- ---------------------------------------------------------------------------
-- 5. attendances — 打刻記録
-- ---------------------------------------------------------------------------
create type clock_method as enum ('face', 'qr', 'manual', 'outside');

create table attendances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes int not null default 0,
  method clock_method,
  location_lat numeric,
  location_lng numeric,
  note text,
  modified_by uuid references users(id) on delete set null,
  modified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);
create index attendances_user_date_idx on attendances(user_id, work_date);
create index attendances_store_date_idx on attendances(store_id, work_date);

-- ---------------------------------------------------------------------------
-- 6. breaks — 休憩明細
-- ---------------------------------------------------------------------------
create table breaks (
  id uuid primary key default uuid_generate_v4(),
  attendance_id uuid not null references attendances(id) on delete cascade,
  break_start timestamptz not null,
  break_end timestamptz,
  created_at timestamptz not null default now()
);
create index breaks_attendance_id_idx on breaks(attendance_id);

-- ---------------------------------------------------------------------------
-- 7. work_time_calculations — 労働時間集計
-- ---------------------------------------------------------------------------
create table work_time_calculations (
  id uuid primary key default uuid_generate_v4(),
  attendance_id uuid not null unique references attendances(id) on delete cascade,
  labor_minutes int not null default 0,
  scheduled_minutes int not null default 0,
  over_scheduled_minutes int not null default 0,
  over_legal_minutes int not null default 0,
  midnight_minutes int not null default 0,
  midnight_over_minutes int not null default 0,
  holiday_minutes int not null default 0,
  holiday_over_minutes int not null default 0,
  calculated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. paid_leaves — 有給申請
-- ---------------------------------------------------------------------------
create type leave_type as enum ('full', 'half_am', 'half_pm');
create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table paid_leaves (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  leave_date date not null,
  leave_type leave_type not null,
  status leave_status not null default 'pending',
  reason text,
  approved_by uuid references users(id) on delete set null,
  applied_at timestamptz not null default now(),
  responded_at timestamptz
);
create index paid_leaves_user_date_idx on paid_leaves(user_id, leave_date);

-- ---------------------------------------------------------------------------
-- 9. shift_patterns — シフトパターン
-- ---------------------------------------------------------------------------
create table shift_patterns (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 0,
  color text,
  created_at timestamptz not null default now()
);
create index shift_patterns_store_id_idx on shift_patterns(store_id);

-- ---------------------------------------------------------------------------
-- 10. shifts — シフト（個人別予定）
-- ---------------------------------------------------------------------------
create type shift_status as enum ('draft', 'published', 'confirmed', 'swap_requested');

create table shifts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  shift_date date not null,
  shift_pattern_id uuid references shift_patterns(id) on delete set null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 0,
  status shift_status not null default 'draft',
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, shift_date)
);
create index shifts_store_date_idx on shifts(store_id, shift_date);
create index shifts_user_date_idx on shifts(user_id, shift_date);

-- ---------------------------------------------------------------------------
-- 11. shift_requests — シフト希望提出
-- ---------------------------------------------------------------------------
create type shift_preference as enum ('want_work', 'want_off', 'flexible');

create table shift_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  target_month text not null,  -- 'YYYY-MM'
  request_date date not null,
  preference shift_preference not null,
  preferred_start time,
  preferred_end time,
  note text,
  submitted_at timestamptz not null default now(),
  unique (user_id, request_date)
);
create index shift_requests_month_idx on shift_requests(target_month);

-- ---------------------------------------------------------------------------
-- 12. shift_swaps — 交代・代行申請
-- ---------------------------------------------------------------------------
create type swap_type as enum ('swap', 'handover');
create type swap_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table shift_swaps (
  id uuid primary key default uuid_generate_v4(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  from_shift_id uuid references shifts(id) on delete set null,
  to_shift_id uuid references shifts(id) on delete set null,
  swap_type swap_type not null,
  status swap_status not null default 'pending',
  reason text,
  approved_by uuid references users(id) on delete set null,
  requested_at timestamptz not null default now(),
  responded_at timestamptz
);

-- ---------------------------------------------------------------------------
-- 13. annual_calendars — 年間カレンダー
-- ---------------------------------------------------------------------------
create type calendar_status as enum ('draft', 'published');

create table annual_calendars (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  year int not null,
  name text not null,
  scheduled_work_days int,
  scheduled_work_hours numeric,
  weekly_work_hours numeric default 40,
  daily_work_hours numeric default 8,
  status calendar_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, year)
);

-- ---------------------------------------------------------------------------
-- 14. calendar_days — 年間カレンダー日別
-- ---------------------------------------------------------------------------
create type day_type as enum (
  'workday', 'legal_holiday', 'scheduled_holiday', 'national_holiday', 'company_holiday'
);

create table calendar_days (
  id uuid primary key default uuid_generate_v4(),
  calendar_id uuid not null references annual_calendars(id) on delete cascade,
  calendar_date date not null,
  day_type day_type not null,
  label text,
  note text,
  unique (calendar_id, calendar_date)
);

-- ---------------------------------------------------------------------------
-- 15. notifications_log — 通知ログ
-- ---------------------------------------------------------------------------
create type notification_type as enum (
  'forgot_clock_in', 'forgot_clock_out', 'overtime_alert',
  'shift_reminder', 'shift_published', 'shift_swap_request', 'shift_request_deadline'
);
create type notification_channel as enum ('slack', 'line', 'email');

create table notifications_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type notification_type not null,
  channel notification_channel not null,
  payload jsonb,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 16. audit_logs — 監査ログ（仕様書 Section 9 要件）
-- ---------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references users(id) on delete set null,
  action text not null,           -- 例: 'attendance.update'
  resource_type text not null,    -- 例: 'attendance'
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs(actor_id);
create index audit_logs_resource_idx on audit_logs(resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- updated_at 自動更新トリガー
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();
create trigger trg_stores_updated_at before update on stores
  for each row execute function set_updated_at();
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();
create trigger trg_attendances_updated_at before update on attendances
  for each row execute function set_updated_at();
create trigger trg_shifts_updated_at before update on shifts
  for each row execute function set_updated_at();
