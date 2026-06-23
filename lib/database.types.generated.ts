export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annual_calendars: {
        Row: {
          created_at: string
          daily_work_hours: number | null
          id: string
          name: string
          published_at: string | null
          scheduled_work_days: number | null
          scheduled_work_hours: number | null
          status: Database["public"]["Enums"]["calendar_status"]
          store_id: string
          weekly_work_hours: number | null
          year: number
        }
        Insert: {
          created_at?: string
          daily_work_hours?: number | null
          id?: string
          name: string
          published_at?: string | null
          scheduled_work_days?: number | null
          scheduled_work_hours?: number | null
          status?: Database["public"]["Enums"]["calendar_status"]
          store_id: string
          weekly_work_hours?: number | null
          year: number
        }
        Update: {
          created_at?: string
          daily_work_hours?: number | null
          id?: string
          name?: string
          published_at?: string | null
          scheduled_work_days?: number | null
          scheduled_work_hours?: number | null
          status?: Database["public"]["Enums"]["calendar_status"]
          store_id?: string
          weekly_work_hours?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "annual_calendars_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          anomaly_codes: string[]
          break_minutes: number
          clock_in: string | null
          clock_out: string | null
          created_at: string
          has_anomaly: boolean
          id: string
          location_lat: number | null
          location_lng: number | null
          method: Database["public"]["Enums"]["clock_method"] | null
          modified_at: string | null
          modified_by: string | null
          note: string | null
          store_id: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          anomaly_codes?: string[]
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          has_anomaly?: boolean
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          method?: Database["public"]["Enums"]["clock_method"] | null
          modified_at?: string | null
          modified_by?: string | null
          note?: string | null
          store_id: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          anomaly_codes?: string[]
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          has_anomaly?: boolean
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          method?: Database["public"]["Enums"]["clock_method"] | null
          modified_at?: string | null
          modified_by?: string | null
          note?: string | null
          store_id?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          auth_method: string | null
          before_data: Json | null
          created_at: string
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          auth_method?: string | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          auth_method?: string | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      breaks: {
        Row: {
          attendance_id: string
          break_end: string | null
          break_start: string
          created_at: string
          id: string
        }
        Insert: {
          attendance_id: string
          break_end?: string | null
          break_start: string
          created_at?: string
          id?: string
        }
        Update: {
          attendance_id?: string
          break_end?: string | null
          break_start?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaks_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_days: {
        Row: {
          calendar_date: string
          calendar_id: string
          day_type: Database["public"]["Enums"]["day_type"]
          id: string
          label: string | null
          note: string | null
        }
        Insert: {
          calendar_date: string
          calendar_id: string
          day_type: Database["public"]["Enums"]["day_type"]
          id?: string
          label?: string | null
          note?: string | null
        }
        Update: {
          calendar_date?: string
          calendar_id?: string
          day_type?: Database["public"]["Enums"]["day_type"]
          id?: string
          label?: string | null
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_days_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "annual_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address1: string | null
          address2: string | null
          brand_color: string | null
          city: string | null
          contact_email: string | null
          corporate_number: string | null
          created_at: string
          employee_scale: string | null
          founded_on: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          name_kana: string | null
          phone: string | null
          prefecture: string | null
          representative_name: string | null
          updated_at: string
          website_url: string | null
          zip: string | null
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          brand_color?: string | null
          city?: string | null
          contact_email?: string | null
          corporate_number?: string | null
          created_at?: string
          employee_scale?: string | null
          founded_on?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          name_kana?: string | null
          phone?: string | null
          prefecture?: string | null
          representative_name?: string | null
          updated_at?: string
          website_url?: string | null
          zip?: string | null
        }
        Update: {
          address1?: string | null
          address2?: string | null
          brand_color?: string | null
          city?: string | null
          contact_email?: string | null
          corporate_number?: string | null
          created_at?: string
          employee_scale?: string | null
          founded_on?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          name_kana?: string | null
          phone?: string | null
          prefecture?: string | null
          representative_name?: string | null
          updated_at?: string
          website_url?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          id: string
          payload: Json | null
          sent_at: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          id?: string
          payload?: Json | null
          sent_at?: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          id?: string
          payload?: Json | null
          sent_at?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_leaves: {
        Row: {
          applied_at: string
          approved_by: string | null
          id: string
          leave_date: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["leave_status"]
          user_id: string
        }
        Insert: {
          applied_at?: string
          approved_by?: string | null
          id?: string
          leave_date: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          user_id: string
        }
        Update: {
          applied_at?: string
          approved_by?: string | null
          id?: string
          leave_date?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_leaves_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_leaves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_patterns: {
        Row: {
          break_minutes: number
          color: string | null
          created_at: string
          end_time: string
          id: string
          name: string
          start_time: string
          store_id: string
        }
        Insert: {
          break_minutes?: number
          color?: string | null
          created_at?: string
          end_time: string
          id?: string
          name: string
          start_time: string
          store_id: string
        }
        Update: {
          break_minutes?: number
          color?: string | null
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_patterns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_requests: {
        Row: {
          id: string
          note: string | null
          preference: Database["public"]["Enums"]["shift_preference"]
          preferred_end: string | null
          preferred_start: string | null
          request_date: string
          submitted_at: string
          target_month: string
          user_id: string
        }
        Insert: {
          id?: string
          note?: string | null
          preference: Database["public"]["Enums"]["shift_preference"]
          preferred_end?: string | null
          preferred_start?: string | null
          request_date: string
          submitted_at?: string
          target_month: string
          user_id: string
        }
        Update: {
          id?: string
          note?: string | null
          preference?: Database["public"]["Enums"]["shift_preference"]
          preferred_end?: string | null
          preferred_start?: string | null
          request_date?: string
          submitted_at?: string
          target_month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swaps: {
        Row: {
          approved_by: string | null
          from_shift_id: string | null
          from_user_id: string
          id: string
          reason: string | null
          requested_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["swap_status"]
          swap_type: Database["public"]["Enums"]["swap_type"]
          to_shift_id: string | null
          to_user_id: string
        }
        Insert: {
          approved_by?: string | null
          from_shift_id?: string | null
          from_user_id: string
          id?: string
          reason?: string | null
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          swap_type: Database["public"]["Enums"]["swap_type"]
          to_shift_id?: string | null
          to_user_id: string
        }
        Update: {
          approved_by?: string | null
          from_shift_id?: string | null
          from_user_id?: string
          id?: string
          reason?: string | null
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          swap_type?: Database["public"]["Enums"]["swap_type"]
          to_shift_id?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_from_shift_id_fkey"
            columns: ["from_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_to_shift_id_fkey"
            columns: ["to_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          note: string | null
          shift_date: string
          shift_pattern_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          note?: string | null
          shift_date: string
          shift_pattern_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          note?: string | null
          shift_date?: string
          shift_pattern_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_shift_pattern_id_fkey"
            columns: ["shift_pattern_id"]
            isOneToOne: false
            referencedRelation: "shift_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          close_time: string | null
          closed_days: number[] | null
          company_id: string
          created_at: string
          day_start_time: string
          id: string
          midnight_end_time: string
          midnight_start_time: string
          name: string
          open_time: string | null
          phone: string | null
          qr_secret: string
          scheduled_daily_minutes: number
          settings: Json
          store_code: string | null
          updated_at: string
          voice_announcement_default: boolean
        }
        Insert: {
          address?: string | null
          close_time?: string | null
          closed_days?: number[] | null
          company_id: string
          created_at?: string
          day_start_time?: string
          id?: string
          midnight_end_time?: string
          midnight_start_time?: string
          name: string
          open_time?: string | null
          phone?: string | null
          qr_secret?: string
          scheduled_daily_minutes?: number
          settings?: Json
          store_code?: string | null
          updated_at?: string
          voice_announcement_default?: boolean
        }
        Update: {
          address?: string | null
          close_time?: string | null
          closed_days?: number[] | null
          company_id?: string
          created_at?: string
          day_start_time?: string
          id?: string
          midnight_end_time?: string
          midnight_start_time?: string
          name?: string
          open_time?: string | null
          phone?: string | null
          qr_secret?: string
          scheduled_daily_minutes?: number
          settings?: Json
          store_code?: string | null
          updated_at?: string
          voice_announcement_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          allowances: Json | null
          bank_account: Json | null
          birthday: string | null
          commute_allowance: number | null
          company_id: string | null
          created_at: string
          daily_wage: number | null
          daily_work_minutes: number | null
          department_id: string | null
          emergency_contact: Json | null
          employee_no: string | null
          employment_type: string | null
          face_auth_enabled: boolean
          face_descriptor: Json | null
          face_descriptors: Json | null
          face_failed_count: number
          face_image_consent: boolean
          face_last_failed_at: string | null
          face_registered_at: string | null
          gender: string | null
          hire_date: string | null
          hourly_wage: number | null
          id: string
          is_active: boolean
          job_title: string | null
          line_user_id: string | null
          monthly_wage: number | null
          name: string
          name_en: string | null
          name_kana: string | null
          notification_settings: Json | null
          paid_leave_days: number | null
          payroll_close_day: number | null
          payroll_pay_day: number | null
          phone: string | null
          qr_issued_at: string | null
          qr_revoke_reason: string | null
          qr_revoked_at: string | null
          qr_revoked_by: string | null
          qr_version: number
          role: Database["public"]["Enums"]["user_role"]
          slack_user_id: string | null
          store_id: string | null
          updated_at: string
          voice_announcement_enabled: boolean | null
          wage_type: string | null
          weekly_workdays: number | null
        }
        Insert: {
          allowances?: Json | null
          bank_account?: Json | null
          birthday?: string | null
          commute_allowance?: number | null
          company_id?: string | null
          created_at?: string
          daily_wage?: number | null
          daily_work_minutes?: number | null
          department_id?: string | null
          emergency_contact?: Json | null
          employee_no?: string | null
          employment_type?: string | null
          face_auth_enabled?: boolean
          face_descriptor?: Json | null
          face_descriptors?: Json | null
          face_failed_count?: number
          face_image_consent?: boolean
          face_last_failed_at?: string | null
          face_registered_at?: string | null
          gender?: string | null
          hire_date?: string | null
          hourly_wage?: number | null
          id: string
          is_active?: boolean
          job_title?: string | null
          line_user_id?: string | null
          monthly_wage?: number | null
          name: string
          name_en?: string | null
          name_kana?: string | null
          notification_settings?: Json | null
          paid_leave_days?: number | null
          payroll_close_day?: number | null
          payroll_pay_day?: number | null
          phone?: string | null
          qr_issued_at?: string | null
          qr_revoke_reason?: string | null
          qr_revoked_at?: string | null
          qr_revoked_by?: string | null
          qr_version?: number
          role?: Database["public"]["Enums"]["user_role"]
          slack_user_id?: string | null
          store_id?: string | null
          updated_at?: string
          voice_announcement_enabled?: boolean | null
          wage_type?: string | null
          weekly_workdays?: number | null
        }
        Update: {
          allowances?: Json | null
          bank_account?: Json | null
          birthday?: string | null
          commute_allowance?: number | null
          company_id?: string | null
          created_at?: string
          daily_wage?: number | null
          daily_work_minutes?: number | null
          department_id?: string | null
          emergency_contact?: Json | null
          employee_no?: string | null
          employment_type?: string | null
          face_auth_enabled?: boolean
          face_descriptor?: Json | null
          face_descriptors?: Json | null
          face_failed_count?: number
          face_image_consent?: boolean
          face_last_failed_at?: string | null
          face_registered_at?: string | null
          gender?: string | null
          hire_date?: string | null
          hourly_wage?: number | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          line_user_id?: string | null
          monthly_wage?: number | null
          name?: string
          name_en?: string | null
          name_kana?: string | null
          notification_settings?: Json | null
          paid_leave_days?: number | null
          payroll_close_day?: number | null
          payroll_pay_day?: number | null
          phone?: string | null
          qr_issued_at?: string | null
          qr_revoke_reason?: string | null
          qr_revoked_at?: string | null
          qr_revoked_by?: string | null
          qr_version?: number
          role?: Database["public"]["Enums"]["user_role"]
          slack_user_id?: string | null
          store_id?: string | null
          updated_at?: string
          voice_announcement_enabled?: boolean | null
          wage_type?: string | null
          weekly_workdays?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_qr_revoked_by_fkey"
            columns: ["qr_revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      work_time_calculations: {
        Row: {
          attendance_id: string
          calculated_at: string
          holiday_minutes: number
          holiday_over_minutes: number
          id: string
          labor_minutes: number
          midnight_minutes: number
          midnight_over_minutes: number
          over_legal_minutes: number
          over_scheduled_minutes: number
          scheduled_minutes: number
        }
        Insert: {
          attendance_id: string
          calculated_at?: string
          holiday_minutes?: number
          holiday_over_minutes?: number
          id?: string
          labor_minutes?: number
          midnight_minutes?: number
          midnight_over_minutes?: number
          over_legal_minutes?: number
          over_scheduled_minutes?: number
          scheduled_minutes?: number
        }
        Update: {
          attendance_id?: string
          calculated_at?: string
          holiday_minutes?: number
          holiday_over_minutes?: number
          id?: string
          labor_minutes?: number
          midnight_minutes?: number
          midnight_over_minutes?: number
          over_legal_minutes?: number
          over_scheduled_minutes?: number
          scheduled_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_time_calculations_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: true
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
        ]

}
      // -----------------------------------------------------------------
      // ⚠️ Phase 5 一時手書き補完（migration 0008）。
      //    本番 db push 後に `npm run db:types`（supabase gen types）で正規再生成し、
      //    このブロックは自動上書きされる前提。手で延命しないこと。
      // -----------------------------------------------------------------
      work_rules: {
        Row: {
          id: string
          scope: string
          company_id: string
          store_id: string | null
          effective_from: string
          scheduled_minutes: number
          work_start: string | null
          work_end: string | null
          break_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scope: string
          company_id: string
          store_id?: string | null
          effective_from: string
          scheduled_minutes?: number
          work_start?: string | null
          work_end?: string | null
          break_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scope?: string
          company_id?: string
          store_id?: string | null
          effective_from?: string
          scheduled_minutes?: number
          work_start?: string | null
          work_end?: string | null
          break_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      holiday_settings: {
        Row: {
          id: string
          scope: string
          company_id: string
          store_id: string | null
          scheduled_holidays: number[]
          legal_holiday: number
          holiday_as: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scope: string
          company_id: string
          store_id?: string | null
          scheduled_holidays?: number[]
          legal_holiday?: number
          holiday_as?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scope?: string
          company_id?: string
          store_id?: string | null
          scheduled_holidays?: number[]
          legal_holiday?: number
          holiday_as?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      japan_holidays: {
        Row: {
          holiday_date: string
          name: string
        }
        Insert: {
          holiday_date: string
          name: string
        }
        Update: {
          holiday_date?: string
          name?: string
        }
        Relationships: []
      }
      user_wage_history: {
        Row: {
          id: string
          user_id: string
          effective_from: string
          unit_wage: number
          job_description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          effective_from: string
          unit_wage: number
          job_description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          effective_from?: string
          unit_wage?: number
          job_description?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_company_id: { Args: never; Returns: string }
      auth_user_department_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      auth_user_store_id: { Args: never; Returns: string }
      is_admin_or_above: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      is_store_or_above: { Args: never; Returns: boolean }
    }
    Enums: {
      calendar_status: "draft" | "published"
      clock_method: "face" | "qr" | "manual" | "outside"
      day_type:
        | "workday"
        | "legal_holiday"
        | "scheduled_holiday"
        | "national_holiday"
        | "company_holiday"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type: "full" | "half_am" | "half_pm"
      notification_channel: "slack" | "line" | "email"
      notification_type:
        | "forgot_clock_in"
        | "forgot_clock_out"
        | "overtime_alert"
        | "shift_reminder"
        | "shift_published"
        | "shift_swap_request"
        | "shift_request_deadline"
      shift_preference: "want_work" | "want_off" | "flexible"
      shift_status: "draft" | "published" | "confirmed" | "swap_requested"
      swap_status: "pending" | "approved" | "rejected" | "cancelled"
      swap_type: "swap" | "handover"
      user_role: "master" | "store" | "admin" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      calendar_status: ["draft", "published"],
      clock_method: ["face", "qr", "manual", "outside"],
      day_type: [
        "workday",
        "legal_holiday",
        "scheduled_holiday",
        "national_holiday",
        "company_holiday",
      ],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["full", "half_am", "half_pm"],
      notification_channel: ["slack", "line", "email"],
      notification_type: [
        "forgot_clock_in",
        "forgot_clock_out",
        "overtime_alert",
        "shift_reminder",
        "shift_published",
        "shift_swap_request",
        "shift_request_deadline",
      ],
      shift_preference: ["want_work", "want_off", "flexible"],
      shift_status: ["draft", "published", "confirmed", "swap_requested"],
      swap_status: ["pending", "approved", "rejected", "cancelled"],
      swap_type: ["swap", "handover"],
      user_role: ["master", "store", "admin", "employee"],
    },
  },
} as const
