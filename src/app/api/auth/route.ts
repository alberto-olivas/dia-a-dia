import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  const { action, email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  try {
    let url: string
    if (action === 'signup') {
      url = `${SUPABASE_URL}/auth/v1/signup`
    } else {
      url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (err) {
    return NextResponse.json(
      { error: `Server fetch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
