-- ============================================================================
-- Phase 3 — 顔認証打刻・ボタン打刻・音声読み上げのための schema 拡張
--
-- 1. users: 顔認証カラム + 音声読み上げ設定
-- 2. stores: 音声読み上げデフォルト設定
-- 3. audit_logs: auth_method カラム追加
-- 4. Supabase Storage: face-images バケット + RLS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. users: 顔認証 + 音声読み上げ
-- ---------------------------------------------------------------------------
alter table users
  add column if not exists face_auth_enabled boolean not null default false,
  add column if not exists face_descriptors jsonb,
  -- 128次元ベクトル×3枚。構造: [[float, ...], [float, ...], [float, ...]]
  add column if not exists face_image_consent boolean not null default false,
  add column if not exists face_registered_at timestamptz,
  add column if not exists face_failed_count int not null default 0,
  add column if not exists face_last_failed_at timestamptz,
  add column if not exists voice_announcement_enabled boolean;
  -- NULL = 店舗デフォルトに委譲。true/false = 個人設定優先

comment on column users.face_auth_enabled is
  '顔認証を有効にするか。DEFAULT false。管理者または本人が設定。';
comment on column users.face_descriptors is
  '顔特徴ベクトル（128次元×最大3枚）。JSON配列: [[f1,f2,...f128], ...]。元画像は保存しない。';
comment on column users.face_image_consent is
  '顔画像をStorageに保存することへの同意。false=特徴ベクトルのみ保存。';
comment on column users.face_failed_count is
  '連続認証失敗回数。3回でQRフォールバック。成功時リセット。';
comment on column users.voice_announcement_enabled is
  'NULL=店舗デフォルト委譲, true/false=個人設定。';

-- 顔認証有効ユーザー用 partial index
create index if not exists users_face_auth_enabled_idx
  on users(id)
  where face_auth_enabled = true and face_descriptors is not null;

-- ---------------------------------------------------------------------------
-- 2. stores: 音声読み上げデフォルト
-- ---------------------------------------------------------------------------
alter table stores
  add column if not exists voice_announcement_default boolean not null default true;

comment on column stores.voice_announcement_default is
  '店舗単位の音声読み上げデフォルト。users.voice_announcement_enabled が NULL のユーザーに適用。';

-- ---------------------------------------------------------------------------
-- 3. audit_logs: 認証方法カラム追加
-- ---------------------------------------------------------------------------
alter table audit_logs
  add column if not exists auth_method text;
  -- 値: 'qr' | 'face' | 'button' | 'face_fallback_qr' | 'face_register' | 'face_reset'

comment on column audit_logs.auth_method is
  '打刻認証方法。qr / face / button / face_fallback_qr / face_register / face_reset。Phase 3 追加。';

-- ---------------------------------------------------------------------------
-- 4. Supabase Storage: face-images バケット + RLS
--    ※ローカル開発では storage.buckets INSERT が可能
--    ※本番(cloud)では Supabase ダッシュボードで手動作成が必要な場合あり
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'face-images',
  'face-images',
  false,
  2097152,  -- 2MB limit per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS policies for face-images bucket

-- 本人: 自分のフォルダのみアップロード可 (path: {user_id}/*)
create policy "face_images_upload_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'face-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 本人: 自分のファイルのみ閲覧可
create policy "face_images_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'face-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from users u
        where u.id = auth.uid()
        and u.role in ('master', 'admin', 'store')
      )
    )
  );

-- 本人: 自分のファイルのみ削除可
create policy "face_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'face-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- master: 全ユーザーの顔画像を管理削除可 (Phase 4 顔データリセット用)
create policy "face_images_delete_master"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'face-images'
    and exists (
      select 1 from users u
      where u.id = auth.uid()
      and u.role = 'master'
    )
  );
