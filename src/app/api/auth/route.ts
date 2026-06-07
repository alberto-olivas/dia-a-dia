import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'

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
  const { action, email, password, supabaseUrl, supabaseKey } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  // Validate that the URL is a legitimate Supabase endpoint
  if (!supabaseUrl || !supabaseUrl.match(/^https:\/\/[a-z]+\.supabase\.co$/)) {
    return NextResponse.json({ error: 'URL de Supabase inválida' }, { status: 400 })
  }

  const endpoint = action === 'signup'
    ? `${supabaseUrl}/auth/v1/signup`
    : `${supabaseUrl}/auth/v1/token?grant_type=password`

  try {
    const { status, body } = await httpsPost(
      endpoint,
      JSON.stringify({ email, password }),
      { apikey: supabaseKey }
    )
    const data = JSON.parse(body)
    return NextResponse.json(data, { status })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
