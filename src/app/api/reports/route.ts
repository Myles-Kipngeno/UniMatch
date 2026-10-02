import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const reportsFilePath = path.join(process.cwd(), 'data', 'reports.json')

const ALLOWED_STATUSES = ['pending', 'under_review', 'resolved', 'dismissed']
const MAX_REASON_LENGTH = 200
const MAX_DETAILS_LENGTH = 2000

// Profile fields the admin moderation panel needs — never return whole rows
const REPORT_PROFILE_FIELDS = 'id, name, photo_url, age, course, campus, email'

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

function unauthorized(message = 'You must be signed in.') {
  return NextResponse.json({ error: message }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
}

/**
 * Builds a Supabase client that acts AS the signed-in user (anon key + their JWT),
 * so every query is subject to Row Level Security. Returns null when the
 * request has no valid session.
 */
async function getAuthedContext(request: Request): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return { supabase, user }
}

async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data as any)?.role === 'admin'
}

export async function GET(request: Request) {
  try {
    const ctx = await getAuthedContext(request)
    if (!ctx) return unauthorized()
    if (!(await isAdmin(ctx.supabase, ctx.user.id))) return forbidden()
    const { supabase } = ctx

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

    const profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select(REPORT_PROFILE_FIELDS)
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
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext(request)
    if (!ctx) return unauthorized('You must be signed in to submit a report.')
    const { supabase, user } = ctx

    const body = await request.json()
    const { reported_id, reason, details } = body

    if (!reported_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required report fields (reported_id or reason).' },
        { status: 400 }
      )
    }

    if (reported_id === user.id) {
      return NextResponse.json({ error: 'You cannot report yourself.' }, { status: 400 })
    }

    // The reporter is always the signed-in user — never trust a reporter_id from the body
    const reportData = {
      reporter_id: user.id,
      reported_id: String(reported_id),
      reason: String(reason).trim().slice(0, MAX_REASON_LENGTH),
      details: details ? String(details).trim().slice(0, MAX_DETAILS_LENGTH) : null,
      status: 'pending'
    }

    // Try DB insert (id and created_at come from the table defaults)
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single()

      if (!error && data) {
        return NextResponse.json({ success: true, data })
      }
      if (error) console.error("Report DB insert error:", error.message)
    } catch (dbErr) { }

    // Fallback: store locally so the report is not lost
    const localReport = {
      id: crypto.randomUUID(),
      ...reportData,
      created_at: new Date().toISOString()
    }
    writeLocalReport(localReport)
    return NextResponse.json({ success: true, data: localReport })
  } catch (err: any) {
    console.error("Server API report handler error:", err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthedContext(request)
    if (!ctx) return unauthorized()
    if (!(await isAdmin(ctx.supabase, ctx.user.id))) return forbidden()

    const body = await request.json()
    const { report_id, status } = body

    if (!report_id || !status) {
      return NextResponse.json({ error: 'Missing report_id or status' }, { status: 400 })
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    updateLocalReportStatus(report_id, status)

    try {
      await (ctx.supabase.from('reports') as any).update({ status }).eq('id', report_id)
    } catch (e) { }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
