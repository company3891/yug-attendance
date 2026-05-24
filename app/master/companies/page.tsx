import { requireRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Company } from '@/lib/database.types'

export default async function CompaniesPage() {
  const me = await requireRole('master')
  const supabase = createClient()
  const { data } = await supabase.from('companies').select('*')
  const companies = (data ?? []) as Company[]
  return (
    <>
      <AppNav user={me} />
      <main className="px-4 py-8 sm:px-6 lg:px-8 md:ml-64">
        <Card>
          <CardHeader>
            <CardTitle>会社管理</CardTitle>
            <CardDescription>マスター専用。Phase 1段階は読み取りのみ。</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {companies.map((c) => (
                <li key={c.id} className="rounded-lg border p-3">
                  <div className="font-medium">{c.name}</div>
                  {c.representative_name && (
                    <div className="text-xs text-muted-foreground">代表: {c.representative_name}</div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
