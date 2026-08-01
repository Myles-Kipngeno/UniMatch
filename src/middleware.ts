import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '../types/database.types'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get and refresh session if needed
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  const url = request.nextUrl.clone()
  const { pathname } = url

  // Define route lists
  const protectedRoutes = [
    '/dashboard',
    '/discover',
    '/matches',
    '/chat',
    '/notifications',
    '/upload-photos',
    '/profile',
  ]
  const authRoutes = ['/login', '/signup']

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  if (isProtectedRoute) {
    if (!user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  if (isAuthRoute) {
    if (user) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
