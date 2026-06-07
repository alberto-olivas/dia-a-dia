import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'

// Strip UTF-8 BOM and whitespace that Vercel CLI sometimes adds to env var values
function clean(s: string | undefined): string {
  return (s ?? '').replace(/^﻿/, '').trim()
}

function httpsPost(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      }
    )
    req.on('error', reject)
    req.setTimeout(10000, () => req.destroy(new Error('timeout')))
    req.write(body)
    req.end()
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, email, password } = body

  // Accept URL/key from request body (browser bundle) or fall back to env vars
  const supabaseUrl = clean(body.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = clean(body.supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  if (!supabaseUrl || !supabaseUrl.includes('.supabase.co')) {
    return NextResponse.json(
      { error: `URL de Supabase inválida: "${supabaseUrl}"` },
      { status: 400 }
    )
  }

  const endpoint = action === 'signup'
    ? `${supabaseUrl}/auth/v1/signup`
    : `${supabaseUrl}/auth/v1/token?grant_type=password`

  try {
    const { status, body: respBody } = await httpsPost(
      endpoint,
      JSON.stringify({ email, password }),
      { apikey: supabaseKey }
    )
    const data = JSON.parse(respBody)
    return NextResponse.json(data, { status })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
