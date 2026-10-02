import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

const ALLOWED_STATUSES = ['pending', 'under_review', 'resolved', 'dismissed']
const MAX_REASON_LENGTH = 200
const MAX_DETAILS_LENGTH = 2000

// Profile fields the admin moderation panel needs — never return whole rows.
// Emails are not stored on profiles; admins get them via admin_user_emails().
const REPORT_PROFILE_FIELDS = 'id, name, photo_url, age, course, campus'

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

    const { data: dbReports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (reportsError) {
      console.error("GET reports DB error:", reportsError.message)
      return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 })
    }

    const allRawReports: any[] = dbReports || []

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

      // Admin-only lookup of account emails (from auth.users)
      try {
        const { data: emailRows } = await supabase.rpc('admin_user_emails', { user_ids: userIds })
        if (Array.isArray(emailRows)) {
          emailRows.forEach((row: any) => {
            if (profilesMap[row.id]) profilesMap[row.id] = { ...profilesMap[row.id], email: row.email }
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

    // id and created_at come from the table defaults
    const { data, error } = await supabase
      .from('reports')
      .insert(reportData)
      .select()
      .single()

    if (error || !data) {
      console.error("Report DB insert error:", error?.message)
      return NextResponse.json(
        { error: "We couldn't submit your report. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
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

    const { error } = await (ctx.supabase.from('reports') as any).update({ status }).eq('id', report_id)
    if (error) {
      console.error("PATCH report DB error:", error.message)
      return NextResponse.json({ error: 'Could not update report.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
