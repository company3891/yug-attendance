// ============================================================================
// scripts/seed-users.mjs
//
// 開発・動作確認用の 4 ユーザー（master/store/admin/employee）を
// Supabase Auth Admin API + UTF-8 で作成し、public.users にもロール情報を投入する。
//
// 重要:
//   - seed.sql で auth.users に直接 INSERT すると GoTrue が auth.identities 等の
//     関連レコードを参照できず「Database error querying schema」になるため、
//     ユーザー作成は必ず本スクリプトを使う。
//
// 前提:
//   - .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済
//   - companies / stores / departments / shift_patterns 等は seed.sql で先に投入済
//
// 使い方:
//   node scripts/seed-users.mjs
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// ----- .env.local 読み込み（簡易パーサ。dotenv なしで完結）-----
const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください')
  process.exit(1)
}

// ----- 固定 ID（seed.sql と整合）-----
const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const STORE_ID   = '22222222-2222-2222-2222-222222222222'
const DEPT_HALL  = '33333333-1111-0000-0000-000000000001'

const USERS = [
  { email: 'master@yug.co.jp', password: 'Master#2026', name: '杉本 悠',        name_kana: 'スギモト ユウ',     role: 'master',   department_id: null,      job_title: '代表',     employment_type: '正社員',   hire_date: '2020-01-01', wage_type: null,     hourly_wage: null },
  { email: 'store@yug.co.jp',  password: 'Store#2026',  name: '店舗管理 太郎', name_kana: 'テンポカンリ タロウ', role: 'store',    department_id: null,      job_title: '店長',     employment_type: '正社員',   hire_date: '2022-04-01', wage_type: null,     hourly_wage: null },
  { email: 'admin@yug.co.jp',  password: 'Admin#2026',  name: '部門管理 花子', name_kana: 'ブモンカンリ ハナコ', role: 'admin',    department_id: DEPT_HALL, job_title: 'チーフ',   employment_type: '正社員',   hire_date: '2023-04-01', wage_type: null,     hourly_wage: null },
  { email: 'staff@yug.co.jp',  password: 'Staff#2026',  name: 'スタッフ 次郎', name_kana: 'スタッフ ジロウ',    role: 'employee', department_id: DEPT_HALL, job_title: 'スタッフ', employment_type: 'アルバイト', hire_date: '2024-04-01', wage_type: 'hourly', hourly_wage: 1100 },
]

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json; charset=utf-8',
}

/** 既存ユーザー一覧を取得 (email → id マップ) */
async function listAuthUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers })
  if (!res.ok) throw new Error(`list auth users failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const map = new Map()
  for (const u of json.users ?? []) map.set(u.email, u.id)
  return map
}

/** auth.users に POST して uid を返す */
async function createAuthUser(email, password, name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
  })
  if (!res.ok) throw new Error(`createUser ${email} failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.id
}

/** public.users に UPSERT（id 指定で onConflict） */
async function upsertPublicUser(uid, u) {
  const body = {
    id: uid,
    name: u.name,
    name_kana: u.name_kana,
    role: u.role,
    company_id: COMPANY_ID,
    store_id: STORE_ID,
    department_id: u.department_id,
    job_title: u.job_title,
    employment_type: u.employment_type,
    hire_date: u.hire_date,
    wage_type: u.wage_type,
    hourly_wage: u.hourly_wage,
    is_active: true,
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`upsert public.users ${u.email} failed: ${res.status} ${await res.text()}`)
}

async function main() {
  console.log(`==> Seed users into ${SUPABASE_URL}`)
  const existing = await listAuthUsers()

  for (const u of USERS) {
    let uid = existing.get(u.email)
    if (uid) {
      console.log(`  - ${u.email} (exists: ${uid})`)
    } else {
      uid = await createAuthUser(u.email, u.password, u.name)
      console.log(`  + ${u.email} (created: ${uid})`)
    }
    await upsertPublicUser(uid, u)
  }

  console.log('==> Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
