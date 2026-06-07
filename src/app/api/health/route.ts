import { NextResponse } from 'next/server'
import https from 'node:https'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
  try {
    const status = await httpsGet(`${SUPABASE_URL}/auth/v1/settings`, SUPABASE_KEY)
    return NextResponse.json({ ok: status >= 200 && status < 400 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
