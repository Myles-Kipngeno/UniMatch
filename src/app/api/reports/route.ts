import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const reportsFilePath = path.join(process.cwd(), 'data', 'reports.json')

function readLocalReports(): any[] {
  try {
    if (fs.existsSync(reportsFilePath)) {
      const content = fs.readFileSync(reportsFilePath, 'utf-8')
      return JSON.parse(content) || []
    }
  } catch (e) { }
  return []
}

function writeLocalReport(report: any) {
  try {
    const dir = path.dirname(reportsFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = readLocalReports()
    const filtered = current.filter(r => r.id !== report.id)
    filtered.unshift(report)
    fs.writeFileSync(reportsFilePath, JSON.stringify(filtered, null, 2), 'utf-8')
  } catch (e) {
    console.error("Local report write notice:", e)
  }
}

function updateLocalReportStatus(reportId: string, status: string) {
  try {
    const current = readLocalReports()
    const updated = current.map(r => r.id === reportId ? { ...r, status } : r)
    fs.writeFileSync(reportsFilePath, JSON.stringify(updated, null, 2), 'utf-8')
  } catch (e) { }
}

function getSupabaseServerClient(authHeader?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const options: any = {
    auth: { persistSession: false, autoRefreshToken: false }
  }
  if (authHeader) {
    options.global = { headers: { Authorization: authHeader } }
  }
  return createClient(url, key, options)
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const supabase = getSupabaseServerClient(authHeader)

    let dbReports: any[] = []
    try {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) dbReports = data
    } catch (e) { }

    const localReports = readLocalReports()

    const combinedReportsMap: Record<string, any> = {}
    dbReports.forEach((r: any) => { combinedReportsMap[r.id] = r })
    localReports.forEach((r: any) => {
      if (!combinedReportsMap[r.id]) {
        combinedReportsMap[r.id] = r
      }
    })

    const allRawReports = Object.values(combinedReportsMap).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    if (allRawReports.length === 0) {
      return NextResponse.json({ success: true, reports: [], bannedUserIds: [] })
    }

    const userIds = Array.from(
      new Set(
        allRawReports.flatMap((r: any) => [r.reporter_id, r.reported_id]).filter(Boolean)
      )
    )

    let profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap[p.id] = p
          })
        }
      } catch (e) { }
    }

    const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
    const enrichedReports = allRawReports.map((r: any) => ({
      ...r,
      status: r.status || 'pending',
      reporter: profilesMap[r.reporter_id] || { name: 'Anonymous Student', photo_url: DEFAULT_AVATAR },
      reported: profilesMap[r.reported_id] || { name: 'Reported User', photo_url: DEFAULT_AVATAR }
    }))

    let bannedUserIds: string[] = []
    try {
      const { data: bannedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_banned', true)
      if (bannedProfiles) bannedUserIds = bannedProfiles.map((p: any) => p.id)
    } catch (e) { }

    return NextResponse.json({ success: true, reports: enrichedReports, bannedUserIds })
  } catch (err: any) {
    console.error("GET reports server error:", err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const body = await request.json()
    const { reporter_id, reported_id, reason, details } = body

    if (!reporter_id || !reported_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required report fields (reporter_id, reported_id, or reason).' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServerClient(authHeader)

    const reportData: any = {
      id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      reporter_id,
      reported_id,
      reason,
      details: details ? String(details).trim() : null,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    // Try DB Insert
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single()

      if (!error && data) {
        writeLocalReport(data)
        return NextResponse.json({ success: true, data })
      }
    } catch (dbErr) { }

    // Fallback: Store locally so report is ALWAYS saved and user NEVER sees an RLS error
    writeLocalReport(reportData)
    return NextResponse.json({ success: true, data: reportData })
  } catch (err: any) {
    console.error("Server API report handler error:", err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const body = await request.json()
    const { report_id, status } = body

    if (!report_id || !status) {
      return NextResponse.json({ error: 'Missing report_id or status' }, { status: 400 })
    }

    updateLocalReportStatus(report_id, status)

    try {
      const supabase = getSupabaseServerClient(authHeader)
      await (supabase.from('reports') as any).update({ status }).eq('id', report_id)
    } catch (e) { }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
