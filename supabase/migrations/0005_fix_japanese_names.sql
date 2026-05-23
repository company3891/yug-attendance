-- PowerShell の JSON エンコードで日本語が ? に化けた public.users を UTF-8 で修正する。
-- auth.users.email を join して該当 id を解決する。

update public.users u
set name = '杉本 悠', name_kana = 'スギモト ユウ', job_title = '代表', employment_type = '正社員'
from auth.users a
where u.id = a.id and a.email = 'master@yug.co.jp';

update public.users u
set name = '店舗管理 太郎', job_title = '店長', employment_type = '正社員'
from auth.users a
where u.id = a.id and a.email = 'store@yug.co.jp';

update public.users u
set name = '部門管理 花子', job_title = 'チーフ', employment_type = '正社員'
from auth.users a
where u.id = a.id and a.email = 'admin@yug.co.jp';

update public.users u
set name = 'スタッフ 次郎', job_title = 'スタッフ', employment_type = 'アルバイト'
from auth.users a
where u.id = a.id and a.email = 'staff@yug.co.jp';
