-- ============================================================================
-- Phase 2 — 打刻機能のための schema 拡張
--
-- 1. stores 拡張: 打刻ルール（起算時刻, 深夜帯, 所定時間）を専用カラム化
-- 2. attendances: 異常検知カラム + index
-- 3. users: QR管理カラム（version/issued/revoked）
-- 4. 連続打刻防止 unique 制約
-- 5. work_time_calculations の自動再計算ヘルパ（純粋トリガでは複雑なのでアプリ側で実行）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. stores: 打刻ルールの専用カラム化
-- ---------------------------------------------------------------------------
alter table stores
  add column if not exists day_start_time time not null default '00:00',
  add column if not exists midnight_start_time time not null default '22:00',
  add column if not exists midnight_end_time time not null default '05:00',
  add column if not exists scheduled_daily_minutes int not null default 480;

-- 既存 settings jsonb から専用カラムへ値を移行（存在すれば上書き）
update stores
set
  day_start_time = coalesce((settings->>'day_start_time')::time, day_start_time),
  midnight_start_time = coalesce((settings->>'midnight_start')::time, midnight_start_time),
  midnight_end_time = coalesce((settings->>'midnight_end')::time, midnight_end_time),
  scheduled_daily_minutes = coalesce((settings->>'daily_work_minutes')::int, scheduled_daily_minutes);

-- ---------------------------------------------------------------------------
-- 2. attendances: 異常検知 + 高速検索 index
-- ---------------------------------------------------------------------------
alter table attendances
  add column if not exists has_anomaly boolean not null default false,
  add column if not exists anomaly_codes text[] not null default '{}';

-- 異常レコードだけ素早く拾えるよう partial index
create index if not exists attendances_anomaly_idx
  on attendances(has_anomaly)
  where has_anomaly = true;

-- 同一ユーザー×同一勤務日の重複防止（既に 0001 で unique 制約あるが、念のため再確認）
-- ※既存制約があるためここでは追加しない

-- 連続打刻防止用: 直前イベントを高速参照するため (user_id, clock_in DESC) の index 追加
create index if not exists attendances_user_clockin_desc_idx
  on attendances(user_id, clock_in desc nulls last);

-- ---------------------------------------------------------------------------
-- 3. users: QR管理カラム
-- ---------------------------------------------------------------------------
alter table users
  add column if not exists qr_version int not null default 1,
  add column if not exists qr_issued_at timestamptz,            -- default なし: 未発行を NULL で表現
  add column if not exists qr_revoked_at timestamptz,
  add column if not exists qr_revoked_by uuid references users(id) on delete set null,
  add column if not exists qr_revoke_reason text;

-- 失効済みユーザーを素早く拾う partial index
create index if not exists users_qr_revoked_idx
  on users(qr_revoked_at)
  where qr_revoked_at is not null;

-- ---------------------------------------------------------------------------
-- 4. 既存 seed の store に専用カラムを反映（飲食店典型値）
-- ---------------------------------------------------------------------------
update stores
set
  day_start_time = '05:00',
  midnight_start_time = '22:00',
  midnight_end_time = '05:00',
  scheduled_daily_minutes = 480
where id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------------------
-- 5. コメント (Schema documentation)
-- ---------------------------------------------------------------------------
comment on column attendances.anomaly_codes is
  '打刻異常コード配列。clock_out_before_in / break_exceeds_work / duration_over_24h / duplicate_clock。CLAUDE.md「打刻異常コード一覧」と同期。';
comment on column users.qr_version is
  'QR失効時に +1。新QR発行で旧QR即時失効。';
comment on column users.qr_issued_at is
  '初回QR発行時刻。NULL = 未発行。発行後3年経過で管理画面に「更新推奨」バッジ表示。';
