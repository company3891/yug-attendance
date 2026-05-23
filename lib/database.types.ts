/**
 * Supabase 型定義（Phase 1 手書き）。
 * マイグレーション確定後は `npm run db:types` で自動生成に置き換える。
 */

export type UserRole = 'master' | 'store' | 'admin' | 'employee'
export type EmploymentType = '正社員' | '契約社員' | 'パート' | 'アルバイト' | '業務委託'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface AppUser {
  id: string
  employee_no: string | null
  name: string
  name_kana: string | null
  name_en: string | null
  birthday: string | null
  gender: string | null
  phone: string | null
  emergency_contact: Json | null
  company_id: string | null
  store_id: string | null
  department_id: string | null
  role: UserRole
  job_title: string | null
  employment_type: EmploymentType | null
  hire_date: string | null
  wage_type: 'hourly' | 'monthly' | 'daily' | null
  hourly_wage: number | null
  monthly_wage: number | null
  daily_wage: number | null
  commute_allowance: number | null
  weekly_workdays: number | null
  daily_work_minutes: number | null
  paid_leave_days: number | null
  slack_user_id: string | null
  line_user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  name_kana: string | null
  representative_name: string | null
  phone: string | null
  contact_email: string | null
  created_at: string
}

export interface Store {
  id: string
  company_id: string
  name: string
  store_code: string | null
  address: string | null
  phone: string | null
  settings: Json
}

export interface Department {
  id: string
  store_id: string
  name: string
}

type TableDef<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      companies: TableDef<Company>
      stores: TableDef<Store>
      departments: TableDef<Department>
      users: {
        Row: AppUser
        Insert: Partial<AppUser> & { id: string; name: string; role: UserRole }
        Update: Partial<AppUser>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}
