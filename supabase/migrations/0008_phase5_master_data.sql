-- ============================================================================
-- Phase 5 — 設定・マスタの土台（就業設定/休日設定/祝日マスタ/給与単価履歴）
--
-- 目的: 勤怠計算を会社ごとの実態で正しく行うための台帳を用意する。
-- 設計原則: 過去の勤怠計算を遡って書き換えない。発効日(effective_from)つき履歴で
--           「その日以降の勤務にのみ反映」する（時点指定）。
--
-- 重複カラムの扱い（Phase 5 方針）:
--   新台帳（work_rules / holiday_settings / user_wage_history）を「正」とする。
--   既存カラム（stores.scheduled_daily_minutes / stores.closed_days /
--   users.daily_work_minutes / users.{hourly,monthly,daily}_wage 等）は
--   削除せず温存し、読み取り経路から外していく。
--   個人別の所定上書きは新規列を作らず既存 users.daily_work_minutes を流用する。
--
-- 適用は別途（db push は明示指示まで保留）。seed/backfill は 0009/0010 で行う。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) work_rules — 就業設定の履歴テーブル（会社デフォルト・店舗個別を共用）
-- ---------------------------------------------------------------------------
create table if not exists work_rules (
  id                uuid primary key default uuid_generate_v4(),
  scope             text not null check (scope in ('company', 'store')),
  company_id        uuid not null references companies(id) on delete cascade,
  store_id          uuid references stores(id) on delete cascade,
  effective_from    date not null,                         -- 適用開始日
  scheduled_minutes int  not null default 480,             -- 所定労働時間（分）
  work_start        time,                                  -- 始業時刻
  work_end          time,                                  -- 終業時刻
  break_minutes     int  not null default 0,               -- 休憩時間（分）
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- scope=store のときのみ store_id 必須、company のときは store_id は null
  constraint work_rules_scope_store_chk check (
    (scope = 'store'   and store_id is not null) or
    (scope = 'company' and store_id is null)
  )
);

-- 解決クエリ（store→company フォールバック、effective_from<=D の最新）を高速化
create index if not exists work_rules_store_eff_idx
  on work_rules(store_id, effective_from desc) where store_id is not null;
create index if not exists work_rules_company_eff_idx
  on work_rules(company_id, effective_from desc) where scope = 'company';
-- 同一対象・同一発効日の重複を防止
create unique index if not exists work_rules_company_eff_uniq
  on work_rules(company_id, effective_from) where scope = 'company';
create unique index if not exists work_rules_store_eff_uniq
  on work_rules(store_id, effective_from) where scope = 'store';

comment on table work_rules is
  'Phase5: 就業設定の発効日つき履歴。ある勤務日Dに有効な設定 = store_id一致かつeffective_from<=Dの最新行、無ければscope=companyの同条件最新行にフォールバック。';

-- ---------------------------------------------------------------------------
-- (B) holiday_settings — 休日・祝日の現在値設定（履歴なし・1対象1行）
-- ---------------------------------------------------------------------------
create table if not exists holiday_settings (
  id                 uuid primary key default uuid_generate_v4(),
  scope              text not null check (scope in ('company', 'store')),
  company_id         uuid not null references companies(id) on delete cascade,
  store_id           uuid references stores(id) on delete cascade,
  scheduled_holidays int[] not null default '{6}',         -- 所定休日の曜日(0=日..6=土) 例:土曜
  legal_holiday      int   not null default 0,             -- 法定休日の曜日(0=日..6=土) 既定:日曜
  holiday_as         text  not null default 'scheduled_holiday'
                          check (holiday_as in ('scheduled_holiday', 'workday')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint holiday_settings_legal_range_chk check (legal_holiday between 0 and 6),
  constraint holiday_settings_scope_store_chk check (
    (scope = 'store'   and store_id is not null) or
    (scope = 'company' and store_id is null)
  )
);

-- 現在値方式: 1対象につき1行
create unique index if not exists holiday_settings_company_uniq
  on holiday_settings(company_id) where scope = 'company';
create unique index if not exists holiday_settings_store_uniq
  on holiday_settings(store_id) where scope = 'store';

comment on table holiday_settings is
  'Phase5: 休日・祝日の現在値設定。所定休日の曜日/法定休日の曜日/祝日の扱い。store→companyフォールバック。';

-- ---------------------------------------------------------------------------
-- (C) japan_holidays — 日本の祝日マスタ（全社共通・システム共通）
--     seed は 0009 で投入（cao.go.jp へは接続しない）
-- ---------------------------------------------------------------------------
create table if not exists japan_holidays (
  holiday_date date primary key,
  name         text not null
);

comment on table japan_holidays is
  'Phase5: 日本の祝日マスタ。内閣府CSV相当を seed で投入。判定: 勤務日が該当かつ店舗のholiday_settings.holiday_as=scheduled_holidayなら所定休日扱い。';

-- ---------------------------------------------------------------------------
-- (D) user_wage_history — 従業員の給与単価・業務内容の履歴
--     ※ wage_type（時給/日給/月給）は現在値として users.wage_type を使う（既存）
--     ※ 個人別の所定上書きは既存 users.daily_work_minutes を流用（新列は作らない）
-- ---------------------------------------------------------------------------
create table if not exists user_wage_history (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  effective_from  date not null,
  unit_wage       int  not null,                           -- 単価（時給/日給=円、月給=月額）
  job_description text,                                    -- 業務内容（記録用・計算に使わない）
  created_at      timestamptz not null default now(),
  constraint user_wage_history_eff_uniq unique (user_id, effective_from)
);

create index if not exists user_wage_history_user_eff_idx
  on user_wage_history(user_id, effective_from desc);

comment on table user_wage_history is
  'Phase5: 給与単価・業務内容の発効日つき履歴。勤務日Dに有効 = user_id一致かつeffective_from<=Dの最新行。最新行は users の現在値カラムへ同期しレポートが参照する。';

-- ---------------------------------------------------------------------------
-- updated_at 自動更新トリガー（set_updated_at は 0001 で定義済み）
-- ---------------------------------------------------------------------------
create trigger trg_work_rules_updated_at before update on work_rules
  for each row execute function set_updated_at();
create trigger trg_holiday_settings_updated_at before update on holiday_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS（CLAUDE.md: 全テーブルでRLS必須）。ヘルパは 0002 で定義済み。
-- ---------------------------------------------------------------------------
alter table work_rules        enable row level security;
alter table holiday_settings  enable row level security;
alter table japan_holidays    enable row level security;
alter table user_wage_history enable row level security;

-- work_rules: 自社のものを参照可。変更は master(全社) / store(自社) ※会社/店舗スコープの厳密制御はアプリ層(requireRole)で担保
create policy work_rules_select on work_rules for select using (
  is_master() or company_id = auth_user_company_id()
);
create policy work_rules_modify on work_rules for all using (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
) with check (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
);

-- holiday_settings: 同上
create policy holiday_settings_select on holiday_settings for select using (
  is_master() or company_id = auth_user_company_id()
);
create policy holiday_settings_modify on holiday_settings for all using (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
) with check (
  is_master() or (is_store_or_above() and company_id = auth_user_company_id())
);

-- japan_holidays: 認証ユーザーは読み取り可、変更は master のみ
create policy japan_holidays_select on japan_holidays for select using (true);
create policy japan_holidays_modify on japan_holidays for all using (is_master())
  with check (is_master());

-- user_wage_history: 本人 or 自社の store以上が参照、変更は自社の store以上
create policy user_wage_history_select on user_wage_history for select using (
  is_master()
  or user_id = auth.uid()
  or (is_store_or_above() and exists (
        select 1 from users u where u.id = user_wage_history.user_id
          and u.company_id = auth_user_company_id()))
);
create policy user_wage_history_modify on user_wage_history for all using (
  is_master()
  or (is_store_or_above() and exists (
        select 1 from users u where u.id = user_wage_history.user_id
          and u.company_id = auth_user_company_id()))
) with check (
  is_master()
  or (is_store_or_above() and exists (
        select 1 from users u where u.id = user_wage_history.user_id
          and u.company_id = auth_user_company_id()))
);
