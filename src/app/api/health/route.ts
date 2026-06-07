import { NextResponse } from 'next/server'
import https from 'node:https'

function clean(s: string | undefined): string {
  return (s ?? '').replace(/^﻿/, '').trim()
}

function httpsGet(url: string, apikey: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname, method: 'GET', headers: { apikey } },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      }
    )
    req.on('error', reject)
    req.setTimeout(8000, () => req.destroy(new Error('timeout')))
    req.end()
  })
}

export async function GET() {
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!supabaseUrl || !supabaseUrl.includes('.supabase.co')) {
    return NextResponse.json({ ok: false, reason: 'env var missing or invalid' }, { status: 503 })
  }

  try {
    const status = await httpsGet(`${supabaseUrl}/auth/v1/settings`, supabaseKey)
    return NextResponse.json({ ok: status >= 200 && status < 400 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
