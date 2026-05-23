-- ============================================================================
-- YUG Attendance — Seed データ（静的参照データのみ）
--
-- 重要: ユーザー作成は本ファイルから除外しています。
--   ・auth.users への直接 INSERT は GoTrue が要求する auth.identities 等の
--     関連レコードを欠き「Database error querying schema」を起こすため。
--   ・ユーザー seed は必ず scripts/seed-users.mjs を使ってください。
--     `npm run db:seed-users` で実行可能。
--
-- 適用順:
--   1. `supabase db push`            ← マイグレーション適用（静的データなし）
--   2. `node ... seed.sql 流し込み`   ← 本ファイル（静的参照データ）
--      ※ ローカル開発時は `supabase db reset` で自動適用
--   3. `npm run db:seed-users`       ← 4 ユーザーを Auth Admin API 経由で作成
-- ============================================================================

-- 会社
insert into companies (id, name, name_kana, representative_name)
values ('11111111-1111-1111-1111-111111111111', '株式会社YUG', 'カブシキガイシャワイユージー', '杉本 悠')
on conflict (id) do nothing;

-- 店舗（勤怠ルール JSON 含む）
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
) on conflict (id) do nothing;

-- 部門
insert into departments (id, store_id, name) values
  ('33333333-1111-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'ホール'),
  ('33333333-1111-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'キッチン'),
  ('33333333-1111-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '管理部')
on conflict (id) do nothing;

-- シフトパターン
insert into shift_patterns (store_id, name, start_time, end_time, break_minutes, color) values
  ('22222222-2222-2222-2222-222222222222', '早番',      '09:00', '17:00', 60, '#3B82F6'),
  ('22222222-2222-2222-2222-222222222222', '遅番',      '17:00', '23:00', 30, '#8B5CF6'),
  ('22222222-2222-2222-2222-222222222222', '通し',      '11:00', '22:00', 90, '#10B981'),
  ('22222222-2222-2222-2222-222222222222', '深夜',      '22:00', '05:00', 60, '#1F2937'),
  ('22222222-2222-2222-2222-222222222222', '半日(午前)','09:00', '13:00',  0, '#7DD3FC')
on conflict do nothing;
