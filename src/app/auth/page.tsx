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
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setConnStatus(d.ok ? 'ok' : 'error'))
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
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'login' ? 'signin' : 'signup',
          email,
          password,
          supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^﻿/, '').trim(),
          supabaseKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/^﻿/, '').trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error || data.error_code || data.msg) {
        const errMsg = data.msg || data.error?.message || data.error || 'Error desconocido'
        setError(translateError({ message: errMsg, status: res.status }))
      } else if (data.access_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        router.replace('/home')
      } else if (mode === 'register' && data.id) {
        setInfo('✓ Cuenta creada. Revisa tu email para confirmar tu cuenta y luego inicia sesión.')
        setMode('login')
      } else {
        setError('Respuesta inesperada del servidor. Inténtalo de nuevo.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Error de conexión: ${msg}`)
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="w-8 h-8 border-2 border-[#00BD7D] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{
        background: 'var(--app-bg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Atmospheric orbs */}
      <div style={{
        position: 'fixed', top: '-20%', right: '-15%',
        width: '65vw', height: '65vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,189,125,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-15%', left: '-20%',
        width: '55vw', height: '55vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Left panel - branding (desktop only) */}
      <div
        className="hidden md:flex md:flex-1 flex-col justify-between p-12"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div>
          <span className="label-caps block">Sistema</span>
          <div className="w-8 h-1 mt-2 rounded-full" style={{ background: '#00BD7D' }} />
        </div>

        <div>
          <h1
            style={{
              fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
              fontSize: 'clamp(4rem, 8vw, 7rem)',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--app-color)',
              letterSpacing: '0.02em',
            }}
          >
            DÍA<br />A<br />DÍA
          </h1>
          <p className="mt-6 max-w-xs" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.7' }}>
            Control total de tu día. Calorías, entrenamientos, tareas — todo en un sistema.
          </p>
        </div>

        <div className="flex gap-8">
          {[['3', 'Módulos'], ['24/7', 'Disponible'], ['∞', 'Historial']].map(([n, l]) => (
            <div key={l}>
              <div style={{
                fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
                fontWeight: 700,
                fontSize: '1.75rem',
                color: '#00BD7D',
              }}>{n}</div>
              <div className="label-caps mt-1">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div
        className="flex flex-1 flex-col justify-center px-6 py-12 md:max-w-md md:mx-auto w-full"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Mobile header */}
        <div className="mb-10 md:hidden">
          <h1 style={{
            fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
            fontSize: '3rem', fontWeight: 700,
            color: 'var(--app-color)', lineHeight: 1,
          }}>
            DÍA A DÍA
          </h1>
          <div className="w-8 h-1 mt-3 rounded-full" style={{ background: '#00BD7D' }} />
        </div>

        {connStatus === 'error' && (
          <div className="mb-6 py-3 px-4 text-sm rounded-xl" style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#DC2626',
          }}>
            ⚠ Sin conexión al servidor. Comprueba tu red o prueba desde otro dispositivo/red.
          </div>
        )}

        {/* Glass form card */}
        <div style={{
          background: 'var(--card-bg)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid var(--card-border)',
          borderRadius: 20,
          boxShadow: 'var(--card-shadow)',
          padding: '2rem',
          borderTop: '3px solid #00BD7D',
        }}>
          <div className="mb-6">
            <span className="label-caps block mb-2">{mode === 'login' ? 'Acceso' : 'Registro'}</span>
            <h2 style={{
              fontFamily: "var(--font-oswald,'Oswald',sans-serif)",
              fontSize: '1.75rem', fontWeight: 600,
              color: 'var(--app-color)',
            }}>
              {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="px-4 py-3 text-sm rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="px-4 py-3 text-sm rounded-xl"
              />
            </div>

            {error && (
              <p className="text-sm py-3 px-4 rounded-xl" style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#DC2626',
              }}>
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm py-3 px-4 rounded-xl" style={{
                background: 'rgba(0,189,125,0.08)',
                border: '1px solid rgba(0,189,125,0.2)',
                color: '#00BD7D',
              }}>
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 py-3.5 font-bold text-sm tracking-widest uppercase transition-opacity disabled:opacity-50 rounded-xl"
              style={{ background: '#00BD7D', color: '#ffffff', boxShadow: '0 4px 12px rgba(0,189,125,0.25)' }}
            >
              {submitting ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 divider" />

          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo('') }}
            className="mt-5 text-sm text-center w-full transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {mode === 'login'
              ? <>¿Sin cuenta? <span style={{ color: '#00BD7D' }} className="font-semibold">Regístrate</span></>
              : <>¿Ya tienes cuenta? <span style={{ color: '#00BD7D' }} className="font-semibold">Inicia sesión</span></>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
