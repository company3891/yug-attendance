-- ============================================================================
-- Phase 5 — 既存レコードへの既定設定 backfill
--
-- 既存の全 company/store/user に、既定の work_rules / holiday_settings /
-- user_wage_history を1件ずつ生成する。これが無いと既存データの計算が設定無しで落ちる。
-- effective_from は安全側で過去日 '2020-01-01'。
-- 冪等: 既に存在する対象は NOT EXISTS でスキップ（再実行可）。
--
-- wage_type 未設定の既存ユーザーは wage 履歴を作らない（「給与種別: 未設定」現挙動を維持）。
-- 既存カラムの値があればそれを引き継ぐ（store の所定/営業時刻、所定休日 closed_days、単価）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- work_rules: 会社デフォルト
-- ---------------------------------------------------------------------------
insert into work_rules (scope, company_id, store_id, effective_from, scheduled_minutes, work_start, work_end, break_minutes)
select 'company', c.id, null, date '2020-01-01', 480, null, null, 0
from companies c
where not exists (
  select 1 from work_rules w where w.scope = 'company' and w.company_id = c.id
);

-- ---------------------------------------------------------------------------
-- work_rules: 店舗デフォルト（既存 stores の値を引き継ぐ）
-- ---------------------------------------------------------------------------
insert into work_rules (scope, company_id, store_id, effective_from, scheduled_minutes, work_start, work_end, break_minutes)
select 'store', s.company_id, s.id, date '2020-01-01',
       coalesce(s.scheduled_daily_minutes, 480), s.open_time, s.close_time, 0
from stores s
where not exists (
  select 1 from work_rules w where w.scope = 'store' and w.store_id = s.id
);

-- ---------------------------------------------------------------------------
-- holiday_settings: 会社デフォルト
-- ---------------------------------------------------------------------------
insert into holiday_settings (scope, company_id, store_id, scheduled_holidays, legal_holiday, holiday_as)
select 'company', c.id, null, '{6}'::int[], 0, 'scheduled_holiday'
from companies c
where not exists (
  select 1 from holiday_settings h where h.scope = 'company' and h.company_id = c.id
);

-- ---------------------------------------------------------------------------
-- holiday_settings: 店舗デフォルト（既存 stores.closed_days を所定休日に引き継ぐ）
-- ---------------------------------------------------------------------------
insert into holiday_settings (scope, company_id, store_id, scheduled_holidays, legal_holiday, holiday_as)
select 'store', s.company_id, s.id,
       coalesce(nullif(s.closed_days, '{}'::int[]), '{6}'::int[]), 0, 'scheduled_holiday'
from stores s
where not exists (
  select 1 from holiday_settings h where h.scope = 'store' and h.store_id = s.id
);

-- ---------------------------------------------------------------------------
-- user_wage_history: 給与種別が設定済み かつ 対応単価が非NULL のユーザーのみ
--   （wage_type 未設定ユーザーは作らない＝未設定のまま）
-- ---------------------------------------------------------------------------
insert into user_wage_history (user_id, effective_from, unit_wage, job_description)
select u.id, date '2020-01-01',
       case u.wage_type
         when 'hourly'  then u.hourly_wage
         when 'daily'   then u.daily_wage
         when 'monthly' then u.monthly_wage
       end,
       u.job_title
from users u
where u.wage_type in ('hourly', 'daily', 'monthly')
  and case u.wage_type
        when 'hourly'  then u.hourly_wage
        when 'daily'   then u.daily_wage
        when 'monthly' then u.monthly_wage
      end is not null
  and not exists (
    select 1 from user_wage_history w where w.user_id = u.id
  );
