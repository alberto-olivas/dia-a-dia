'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function AuthPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [connStatus, setConnStatus] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    if (!loading && user) {
      router.replace('/home')
    }
  }, [user, loading, router])

  useEffect(() => {
    // Test direct connectivity to Supabase on mount
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url.includes('placeholder')) {
      setConnStatus('error')
      return
    }
    fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    })
      .then((r) => setConnStatus(r.ok ? 'ok' : 'error'))
      .catch(() => setConnStatus('error'))
  }, [])

  function translateError(err: { message: string; status?: number }): string {
    const msg = err.message.toLowerCase()
    if (msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('networkerror') || msg.includes('network request failed')) {
      return `Error de red: tu navegador no puede conectar con el servidor (${err.message}). Prueba desde otra red o desactiva extensiones del navegador.`
    }
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return 'Email o contraseña incorrectos'
    }
    if (msg.includes('email not confirmed')) {
      return 'Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada'
    }
    if (msg.includes('user already registered') || msg.includes('already been registered')) {
      return 'Este email ya está registrado. Inicia sesión en su lugar'
    }
    if (msg.includes('password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres'
    }
    if (msg.includes('unable to validate email address')) {
      return 'El formato del email no es válido'
    }
    return `${err.message}${err.status ? ` (${err.status})` : ''}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(translateError(error))
        } else {
          router.replace('/home')
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(translateError(error))
        } else if (data.user && !data.session) {
          setInfo('✓ Cuenta creada. Revisa tu email para confirmar tu cuenta y luego inicia sesión.')
          setMode('login')
        } else if (data.session) {
          router.replace('/home')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Error: ${msg}. Prueba desde otra red o desactiva extensiones del navegador.`)
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-[#FF2D00] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: '#0a0a0a' }}>
      {/* Left panel - branding (desktop only) */}
      <div
        className="hidden md:flex md:flex-1 flex-col justify-between p-12 border-r"
        style={{ borderColor: '#2a2a2a' }}
      >
        <div>
          <span className="label-caps">Sistema</span>
          <div
            className="w-8 h-1 mt-2"
            style={{ background: '#FF2D00' }}
          />
        </div>

        <div>
          <h1
            className="font-black leading-none tracking-tight"
            style={{ fontSize: 'clamp(4rem, 8vw, 7rem)', color: '#ffffff' }}
          >
            DÍA<br />A<br />DÍA
          </h1>
          <p className="mt-6 max-w-xs" style={{ color: '#555555', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Control total de tu día. Calorías, entrenamientos, tareas — todo en un sistema.
          </p>
        </div>

        <div className="flex gap-8">
          <div>
            <div className="font-black text-3xl" style={{ color: '#FF2D00' }}>3</div>
            <div className="label-caps mt-1">Módulos</div>
          </div>
          <div>
            <div className="font-black text-3xl" style={{ color: '#FF2D00' }}>24/7</div>
            <div className="label-caps mt-1">Disponible</div>
          </div>
          <div>
            <div className="font-black text-3xl" style={{ color: '#FF2D00' }}>∞</div>
            <div className="label-caps mt-1">Historial</div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 md:max-w-md md:mx-auto w-full">
        {/* Mobile header */}
        <div className="mb-10 md:hidden">
          <h1
            className="font-black leading-none"
            style={{ fontSize: '3.5rem', color: '#ffffff' }}
          >
            DÍA A DÍA
          </h1>
          <div className="w-8 h-1 mt-3" style={{ background: '#FF2D00' }} />
        </div>

        {/* Connection status indicator */}
        {connStatus === 'error' && (
          <div className="mb-6 py-3 px-4 text-sm" style={{ background: 'rgba(255,45,0,0.1)', border: '1px solid #FF2D00', color: '#FF2D00' }}>
            ⚠ Sin conexión al servidor. Comprueba tu red o prueba desde otro dispositivo/red.
          </div>
        )}

        {/* Form header */}
        <div className="mb-8">
          <span className="label-caps">{mode === 'login' ? 'Acceso' : 'Registro'}</span>
          <h2
            className="font-black mt-1"
            style={{ fontSize: '1.75rem', color: '#ffffff' }}
          >
            {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="label-caps" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="px-4 py-3 text-sm rounded-none"
              style={{ background: '#111111', border: '1px solid #2a2a2a', color: '#fff' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-caps" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="px-4 py-3 text-sm rounded-none"
              style={{ background: '#111111', border: '1px solid #2a2a2a', color: '#fff' }}
            />
          </div>

          {error && (
            <p className="text-sm py-3 px-4" style={{ background: 'rgba(255,45,0,0.1)', border: '1px solid #FF2D00', color: '#FF2D00' }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm py-3 px-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#888' }}>
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 py-4 font-bold text-sm tracking-widest uppercase transition-opacity disabled:opacity-50"
            style={{ background: '#FF2D00', color: '#ffffff' }}
          >
            {submitting ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-6 divider" />

        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo('') }}
          className="mt-6 text-sm text-center transition-colors"
          style={{ color: '#555555' }}
        >
          {mode === 'login'
            ? <>¿Sin cuenta? <span style={{ color: '#ffffff' }} className="font-semibold">Regístrate</span></>
            : <>¿Ya tienes cuenta? <span style={{ color: '#ffffff' }} className="font-semibold">Inicia sesión</span></>
          }
        </button>
      </div>
    </div>
  )
}
