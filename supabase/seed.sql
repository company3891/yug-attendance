-- ============================================================================
-- YUG Attendance — Seed データ
-- 開発・動作確認用に「株式会社YUG」「YUG本店」「4権限のテストユーザー」を投入
-- ============================================================================

-- 会社
insert into companies (id, name, name_kana, representative_name)
values ('11111111-1111-1111-1111-111111111111', '株式会社YUG', 'カブシキガイシャワイユージー', '杉本 悠');

-- 店舗
insert into stores (id, company_id, name, store_code, settings)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'YUG本店',
  'YUG-001',
  jsonb_build_object(
    'daily_work_minutes', 480,
    'weekly_work_minutes', 2400,
    'week_start_day', 1,
    'day_start_time', '05:00',
    'midnight_start', '22:00',
    'midnight_end', '05:00',
    'legal_holiday_dow', 0,
    'break_auto_6h_8h', 45,
    'break_auto_over_8h', 60,
    'late_threshold_minutes', 1,
    'overtime_premium_pct', 25,
    'midnight_premium_pct', 25,
    'holiday_premium_pct', 35
  )
);

-- 部門
insert into departments (id, store_id, name) values
  ('33333333-1111-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'ホール'),
  ('33333333-1111-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'キッチン'),
  ('33333333-1111-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '管理部');

-- シフトパターン
insert into shift_patterns (store_id, name, start_time, end_time, break_minutes, color) values
  ('22222222-2222-2222-2222-222222222222', '早番',     '09:00', '17:00', 60, '#3B82F6'),
  ('22222222-2222-2222-2222-222222222222', '遅番',     '17:00', '23:00', 30, '#8B5CF6'),
  ('22222222-2222-2222-2222-222222222222', '通し',     '11:00', '22:00', 90, '#10B981'),
  ('22222222-2222-2222-2222-222222222222', '深夜',     '22:00', '05:00', 60, '#1F2937'),
  ('22222222-2222-2222-2222-222222222222', '半日(午前)','09:00', '13:00',  0, '#7DD3FC');

-- ---------------------------------------------------------------------------
-- 注意: auth.users への INSERT は Supabase Auth API 経由が原則。
-- 開発時は Supabase ダッシュボードまたは下記のように直接挿入する。
-- パスワードは bcrypt ハッシュで保存される必要があり、ここではプレースホルダ。
--
-- 本番運用では以下のシード実行後、ダッシュボードまたは scripts/seed-users.ts で
-- 各ユーザーをパスワード付きで作成し、public.users にロール情報を upsert する。
-- ---------------------------------------------------------------------------

-- マスター
do $$
declare
  v_id uuid;
begin
  v_id := '44444444-0000-0000-0000-000000000001';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'master@yug.co.jp',
    crypt('Master#2026', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"name":"杉本 悠"}', false, '', '', ''
  ) on conflict (id) do nothing;
  insert into public.users (id, name, name_kana, role, company_id, store_id, employment_type, hire_date, is_active)
  values (v_id, '杉本 悠', 'スギモト ユウ', 'master',
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    '正社員', '2020-01-01', true)
  on conflict (id) do update set role = excluded.role;
end $$;

-- 店舗管理者
do $$
declare v_id uuid;
begin
  v_id := '44444444-0000-0000-0000-000000000002';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'store@yug.co.jp', crypt('Store#2026', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"name":"店舗管理 太郎"}', false, '', '', '')
  on conflict (id) do nothing;
  insert into public.users (id, name, role, company_id, store_id, employment_type, hire_date, is_active)
  values (v_id, '店舗管理 太郎', 'store',
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    '正社員', '2022-04-01', true)
  on conflict (id) do update set role = excluded.role;
end $$;

-- 部門管理者
do $$
declare v_id uuid;
begin
  v_id := '44444444-0000-0000-0000-000000000003';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@yug.co.jp', crypt('Admin#2026', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"name":"部門管理 花子"}', false, '', '', '')
  on conflict (id) do nothing;
  insert into public.users (id, name, role, company_id, store_id, department_id, job_title, employment_type, hire_date, is_active)
  values (v_id, '部門管理 花子', 'admin',
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    '33333333-1111-0000-0000-000000000001', 'チーフ', '正社員', '2023-04-01', true)
  on conflict (id) do update set role = excluded.role;
end $$;

-- 一般従業員
do $$
declare v_id uuid;
begin
  v_id := '44444444-0000-0000-0000-000000000004';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'staff@yug.co.jp', crypt('Staff#2026', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"name":"スタッフ 次郎"}', false, '', '', '')
  on conflict (id) do nothing;
  insert into public.users (id, name, role, company_id, store_id, department_id, job_title, employment_type, hire_date, wage_type, hourly_wage, is_active)
  values (v_id, 'スタッフ 次郎', 'employee',
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    '33333333-1111-0000-0000-000000000001', 'スタッフ', 'アルバイト', '2024-04-01',
    'hourly', 1100, true)
  on conflict (id) do update set role = excluded.role;
end $$;
