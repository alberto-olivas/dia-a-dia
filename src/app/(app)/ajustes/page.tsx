'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useProfile } from '@/lib/profile-context'
import { useTheme } from '@/lib/theme-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import { User, Cake, Weight, Ruler, Mail, Lock, Sun, Moon, Save, CheckCircle, AlertCircle, Download, Smartphone, MonitorSmartphone, Flame } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function calcAge(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return '—'
  const diff = Date.now() - new Date(fechaNacimiento).getTime()
  return `${Math.floor(diff / 3.15576e10)} años`
}

type Msg = { type: 'ok' | 'err'; text: string }

export default function AjustesPage() {
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { theme, toggleTheme } = useTheme()

  // ── PWA install ───────────────────────────────────
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDone, setInstallDone] = useState(false)

  // ── Perfil fields ─────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [peso, setPeso] = useState('')
  const [altura, setAltura] = useState('')
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  // ── Calorie goal ──────────────────────────────────
  const [calorieGoal, setCalorieGoal] = useState(2500)

  useEffect(() => {
    const saved = parseInt(localStorage.getItem('calorie_goal') ?? '') || 2500
    setCalorieGoal(saved)
  }, [])

  function saveCalorieGoal(val: number) {
    const clamped = Math.max(500, Math.min(10000, val))
    setCalorieGoal(clamped)
    localStorage.setItem('calorie_goal', String(clamped))
  }

  // ── Cuenta fields ─────────────────────────────────
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState<Msg | null>(null)
  const [emailSaving, setEmailSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
    setIsIOS(/iPad|iPhone|iPod/i.test(navigator.userAgent))
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') { setInstallDone(true); setDeferredPrompt(null) }
  }

  // Sync profile values when loaded
  useEffect(() => {
    if (!profile) return
    setNombre(profile.nombre)
    setFechaNacimiento(profile.fecha_nacimiento ?? '')
    setPeso(profile.peso != null ? String(profile.peso) : '')
    setAltura(profile.altura != null ? String(profile.altura) : '')
  }, [profile])

  async function saveProfile() {
    if (!nombre.trim()) { setProfileMsg({ type: 'err', text: 'El nombre no puede estar vacío' }); return }
    setProfileSaving(true)
    await updateProfile({
      nombre: nombre.trim(),
      fecha_nacimiento: fechaNacimiento || null,
      peso: peso ? parseFloat(peso) : null,
      altura: altura ? parseInt(altura) : null,
    })
    setProfileMsg({ type: 'ok', text: 'Perfil actualizado' })
    setProfileSaving(false)
    setTimeout(() => setProfileMsg(null), 3000)
  }

  async function changeEmail() {
    if (!newEmail.trim()) return
    setEmailSaving(true)
    if (!IS_SUPABASE_CONFIGURED) {
      setEmailMsg({ type: 'err', text: 'Requiere Supabase configurado' })
      setEmailSaving(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailMsg(error
      ? { type: 'err', text: error.message }
      : { type: 'ok', text: 'Revisa tu nuevo correo para confirmar el cambio' }
    )
    setEmailSaving(false)
    if (!error) setNewEmail('')
    setTimeout(() => setEmailMsg(null), 5000)
  }

  async function changePassword() {
    if (newPassword.length < 6) { setPasswordMsg({ type: 'err', text: 'Mínimo 6 caracteres' }); return }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'err', text: 'Las contraseñas no coinciden' }); return }
    setPasswordSaving(true)
    if (!IS_SUPABASE_CONFIGURED) {
      setPasswordMsg({ type: 'err', text: 'Requiere Supabase configurado' })
      setPasswordSaving(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordMsg(error
      ? { type: 'err', text: error.message }
      : { type: 'ok', text: 'Contraseña actualizada correctamente' }
    )
    setPasswordSaving(false)
    if (!error) { setNewPassword(''); setConfirmPassword('') }
    setTimeout(() => setPasswordMsg(null), 4000)
  }

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-8">
        <span className="label-caps block mb-1">Módulo 05</span>
        <h1 className="font-black text-3xl" style={{ color: 'var(--app-color)' }}>AJUSTES</h1>
      </header>

      {/* ── Sección: Tu perfil ───────────────────── */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <User size={14} style={{ color: '#FF6B35' }} />
          <span className="label-caps">Tu perfil</span>
        </div>
        <div className="card p-5 flex flex-col gap-4" style={{ backgroundImage: 'radial-gradient(ellipse at 78% 16%, rgba(76,134,228,0.36) 0%, transparent 38%), radial-gradient(ellipse at 38% 48%, rgba(136,170,238,0.24) 0%, transparent 48%)' }}>

          {/* Nombre */}
          <div>
            <label className="label-caps block mb-1.5">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="¿Cómo te llamamos?"
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold"
            />
          </div>

          {/* Cumpleaños */}
          <div>
            <label className="label-caps block mb-1.5">
              Cumpleaños
              {fechaNacimiento && (
                <span className="ml-2 normal-case font-semibold" style={{ color: '#FF6B35' }}>
                  {calcAge(fechaNacimiento)}
                </span>
              )}
            </label>
            <div className="relative">
              <Cake size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-semibold"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Peso + Altura */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps block mb-1.5">Peso</label>
              <div className="relative">
                <Weight size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="number"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  placeholder="75"
                  min="30" max="250" step="0.5"
                  className="w-full pl-9 pr-9 py-3 rounded-xl text-sm font-black"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>kg</span>
              </div>
            </div>
            <div>
              <label className="label-caps block mb-1.5">Altura</label>
              <div className="relative">
                <Ruler size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="number"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  placeholder="175"
                  min="100" max="230"
                  className="w-full pl-9 pr-9 py-3 rounded-xl text-sm font-black"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>cm</span>
              </div>
            </div>
          </div>

          {/* Feedback + Save */}
          {profileMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: profileMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: profileMsg.type === 'ok' ? '#16A34A' : '#DC2626' }}>
              {profileMsg.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {profileMsg.text}
            </div>
          )}
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm tracking-widest uppercase disabled:opacity-50"
            style={{ background: '#1A1A1A', color: '#ffffff' }}
          >
            <Save size={14} />
            {profileSaving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </div>
      </section>

      {/* ── Sección: Objetivo calórico ───────────── */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Flame size={14} style={{ color: '#FF6B35' }} />
          <span className="label-caps">Objetivo calórico</span>
        </div>
        <div className="card p-5" style={{ backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(255,107,53,0.28) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(255,155,80,0.18) 0%, transparent 45%)' }}>
          <p className="text-xs text-gray-500 mb-4">
            Personaliza tu objetivo de calorías diarias. Se usará en el apartado de Alimentación.
          </p>

          {/* Input + presets */}
          <div className="flex items-center gap-3 mb-3">
            <input
              type="number"
              value={calorieGoal || ''}
              onChange={(e) => saveCalorieGoal(parseInt(e.target.value) || 2500)}
              min="500"
              max="10000"
              step="50"
              className="flex-1 px-4 py-3 text-xl font-black rounded-xl text-center"
              style={{ color: '#FF6B35' }}
            />
            <span className="text-sm font-bold text-gray-400">kcal / día</span>
          </div>

          <div className="flex gap-2">
            {[1500, 1800, 2000, 2500, 3000, 3500].map((kcal) => (
              <button
                key={kcal}
                onClick={() => saveCalorieGoal(kcal)}
                className="flex-1 py-2 text-[10px] font-bold rounded-lg transition-all"
                style={{
                  background: calorieGoal === kcal ? '#FF6B35' : '#F5F5F7',
                  color: calorieGoal === kcal ? '#FFFFFF' : '#9CA3AF',
                }}
              >
                {(kcal / 1000).toFixed(1)}k
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sección: Tu cuenta ───────────────────── */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={14} style={{ color: '#FF6B35' }} />
          <span className="label-caps">Tu cuenta</span>
        </div>
        <div className="card p-5 flex flex-col gap-5">

          {!IS_SUPABASE_CONFIGURED && (
            <p className="text-xs font-semibold px-3 py-2.5 rounded-xl" style={{ background: 'var(--input-bg)', color: 'var(--text-muted)' }}>
              Conecta Supabase para cambiar email y contraseña
            </p>
          )}

          {/* Email */}
          <div>
            <label className="label-caps block mb-1">Email actual</label>
            <p className="text-sm font-bold mb-3 truncate" style={{ color: 'var(--app-color)' }}>{user?.email}</p>
            <label className="label-caps block mb-1.5">Nuevo email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
              disabled={!IS_SUPABASE_CONFIGURED}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold mb-2 disabled:opacity-40"
            />
            {emailMsg && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold mb-2"
                style={{ background: emailMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: emailMsg.type === 'ok' ? '#16A34A' : '#DC2626' }}>
                {emailMsg.type === 'ok' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {emailMsg.text}
              </div>
            )}
            <button
              onClick={changeEmail}
              disabled={emailSaving || !newEmail.trim() || !IS_SUPABASE_CONFIGURED}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm tracking-widest uppercase disabled:opacity-40"
              style={{ background: 'var(--input-bg)', color: 'var(--app-color)' }}
            >
              {emailSaving ? 'Enviando...' : 'Cambiar email'}
            </button>
          </div>

          <div className="divider" />

          {/* Password */}
          <div>
            <label className="label-caps block mb-1.5">Nueva contraseña</label>
            <div className="relative mb-2">
              <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={!IS_SUPABASE_CONFIGURED}
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              />
            </div>
            <label className="label-caps block mb-1.5">Confirmar contraseña</label>
            <div className="relative mb-2">
              <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                disabled={!IS_SUPABASE_CONFIGURED}
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              />
            </div>
            {passwordMsg && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold mb-2"
                style={{ background: passwordMsg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: passwordMsg.type === 'ok' ? '#16A34A' : '#DC2626' }}>
                {passwordMsg.type === 'ok' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {passwordMsg.text}
              </div>
            )}
            <button
              onClick={changePassword}
              disabled={passwordSaving || !newPassword || !IS_SUPABASE_CONFIGURED}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm tracking-widest uppercase disabled:opacity-40"
              style={{ background: 'var(--input-bg)', color: 'var(--app-color)' }}
            >
              {passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Sección: Instalar app ───────────────── */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MonitorSmartphone size={14} style={{ color: '#FF6B35' }} />
          <span className="label-caps">Instalar app</span>
        </div>
        <div className="card p-5" style={{ backgroundImage: 'radial-gradient(ellipse at 48% 42%, rgba(38,94,215,0.42) 0%, rgba(62,122,230,0.26) 28%, transparent 55%), radial-gradient(ellipse at 58% 28%, rgba(38,90,215,0.24) 0%, transparent 36%)' }}>
          {isStandalone || installDone ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                <CheckCircle size={18} style={{ color: '#16A34A' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--app-color)' }}>App instalada</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ya estás usando la versión instalada</p>
              </div>
            </div>
          ) : isIOS ? (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF4EF' }}>
                <Smartphone size={18} style={{ color: '#FF6B35' }} />
              </div>
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--app-color)' }}>Añadir a pantalla de inicio</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  En Safari pulsa el botón <span className="font-bold" style={{ color: 'var(--app-color)' }}>Compartir</span> →{' '}
                  <span className="font-bold" style={{ color: 'var(--app-color)' }}>Añadir a pantalla de inicio</span>
                </p>
              </div>
            </div>
          ) : deferredPrompt ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF4EF' }}>
                  <Download size={18} style={{ color: '#FF6B35' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--app-color)' }}>Instalar en este dispositivo</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Acceso rápido, sin navegador</p>
                </div>
              </div>
              <button
                onClick={handleInstall}
                className="shrink-0 px-4 py-2 rounded-xl font-bold text-xs tracking-widest uppercase"
                style={{ background: '#FF6B35', color: '#ffffff' }}
              >
                Instalar
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--input-bg)' }}>
                <Download size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--app-color)' }}>Instalar app</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Abre esta página en Chrome o Edge y el botón de instalación aparecerá aquí
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Sección: Apariencia ──────────────────── */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sun size={14} style={{ color: '#FF6B35' }} />
          <span className="label-caps">Apariencia</span>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: theme === 'dark' ? '#1C1C21' : '#FFF4EF' }}
              >
                {theme === 'dark'
                  ? <Moon size={18} style={{ color: '#8B8BF8' }} />
                  : <Sun size={18} style={{ color: '#FF6B35' }} />
                }
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--app-color)' }}>
                  Modo {theme === 'dark' ? 'oscuro' : 'claro'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {theme === 'dark' ? 'Fondo oscuro activado' : 'Fondo claro activado'}
                </p>
              </div>
            </div>
            {/* Toggle switch */}
            <button
              onClick={toggleTheme}
              className="relative w-14 h-7 rounded-full transition-all flex-shrink-0"
              style={{ background: theme === 'dark' ? '#8B5CF6' : '#E5E7EB' }}
              aria-label="Toggle dark mode"
            >
              <div
                className="absolute top-1 w-5 h-5 rounded-full transition-all"
                style={{
                  background: '#FFFFFF',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  left: theme === 'dark' ? 'calc(100% - 24px)' : '4px',
                }}
              />
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}
