'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { WorkoutType, Workout } from '@/lib/types'
import { WORKOUT_TYPES } from '@/lib/types'
import { Zap, Clock, Save, Trash2, Flame, Shield, Dumbbell, Activity, Moon, Footprints, BedDouble } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ── Personal workout database (kcal/h per intensity level) ─────────────────
const ALBERTO_WORKOUTS: Record<WorkoutType, { suave: number; medio: number; intenso: number; duracion: number }> = {
  boxeo_tecnica: { suave: 500,  medio: 650,  intenso: 850,  duracion: 60 },
  boxeo_fisico:  { suave: 750,  medio: 900,  intenso: 1050, duracion: 60 },
  sparring:      { suave: 850,  medio: 1100, intenso: 1400, duracion: 60 },
  pesas:         { suave: 250,  medio: 375,  intenso: 550,  duracion: 45 },
  boxeo_pesas:   { suave: 700,  medio: 900,  intenso: 1200, duracion: 90 },
  descanso:      { suave: 0,    medio: 0,    intenso: 0,    duracion: 0  },
}

type IntensityLevel = 'suave' | 'medio' | 'intenso'
const INTENSITY_CONFIG: Record<IntensityLevel, { label: string; color: string; bg: string; emoji: string }> = {
  suave:   { label: 'Suave',   color: '#22C55E', bg: '#F0FDF4', emoji: '🟢' },
  medio:   { label: 'Medio',   color: '#F59E0B', bg: '#FFFBEB', emoji: '🟡' },
  intenso: { label: 'Intenso', color: '#EF4444', bg: '#FEF2F2', emoji: '🔴' },
}

type ConditionId = 'normal' | 'calor_moderado' | 'mucho_calor'
const CONDITIONS: { id: ConditionId; label: string; sub: string; icon: string; multiplier: number }[] = [
  { id: 'normal',         label: 'Normal',         sub: 'sin cambios',   icon: '🌡️', multiplier: 1.0 },
  { id: 'calor_moderado', label: 'Calor moderado', sub: '+20% calorías', icon: '🌤️', multiplier: 1.2 },
  { id: 'mucho_calor',    label: 'Mucho calor',    sub: '+50% calorías', icon: '🔥', multiplier: 1.5 },
]

const WORKOUT_ICONS: Record<WorkoutType, React.ComponentType<{ size: number; color?: string }>> = {
  boxeo_tecnica: Zap,
  boxeo_fisico: Flame,
  sparring: Shield,
  pesas: Dumbbell,
  boxeo_pesas: Activity,
  descanso: Moon,
}
const WORKOUT_BG: Record<WorkoutType, string> = {
  boxeo_tecnica: '#FFF4EF', boxeo_fisico: '#FFF1F0', sparring: '#F5F3FF',
  pesas: '#EFF6FF', boxeo_pesas: '#FDF4FF', descanso: '#F9FAFB',
}
const WORKOUT_COLOR: Record<WorkoutType, string> = {
  boxeo_tecnica: '#FF6B35', boxeo_fisico: '#EF4444', sparring: '#8B5CF6',
  pesas: '#3B82F6', boxeo_pesas: '#EC4899', descanso: '#9CA3AF',
}

function getLast7Days(): Array<{ date: string; label: string }> {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { date: d.toISOString().split('T')[0], label: i === 6 ? 'Hoy' : days[d.getDay()] }
  })
}

export default function EntrenoPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [saving, setSaving] = useState(false)
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; kcal: number }>>([])
  const [history, setHistory] = useState<Workout[]>([])
  const [mounted, setMounted] = useState(false)

  const [selectedType, setSelectedType] = useState<WorkoutType>('boxeo_tecnica')
  const [intensidad, setIntensidad] = useState<IntensityLevel>('medio')
  const [condicion, setCondicion] = useState<ConditionId>('normal')
  const [duracion, setDuracion] = useState<number>(60)
  const [steps, setSteps] = useState(0)
  const [sleepHours, setSleepHours] = useState(0)

  useEffect(() => {
    setMounted(true)
    setSteps(parseInt(localStorage.getItem(`steps_${today}`) ?? '0') || 0)
    setSleepHours(parseFloat(localStorage.getItem(`sleep_${today}`) ?? '0') || 0)
  }, [])

  useEffect(() => {
    if (!user) return
    if (!IS_SUPABASE_CONFIGURED) {
      try {
        const saved = JSON.parse(localStorage.getItem(`demo_workout_${today}`) ?? 'null')
        if (saved) {
          setWorkout(saved)
          setSelectedType(saved.tipo as WorkoutType)
          setDuracion(saved.duracion_minutos || 60)
        }
      } catch {}
      setLoading(false)
      return
    }
    fetchWorkout()
    fetchWeeklyData()
  }, [user])

  async function fetchWorkout() {
    setLoading(true)
    const { data } = await supabase
      .from('workouts').select('*')
      .eq('user_id', user!.id).eq('fecha', today).maybeSingle()
    if (data) {
      setWorkout(data)
      setSelectedType(data.tipo as WorkoutType)
      setDuracion(data.duracion_minutos)
    }
    setLoading(false)
  }

  async function fetchWeeklyData() {
    const last7 = getLast7Days()
    const { data } = await supabase
      .from('workouts').select('fecha, calorias_quemadas, tipo, duracion_minutos')
      .eq('user_id', user!.id).in('fecha', last7.map((d) => d.date))
      .order('fecha', { ascending: true })
    setWeeklyData(last7.map(({ date, label }) => ({
      day: label,
      kcal: data?.find((w: { fecha: string }) => w.fecha === date)?.calorias_quemadas ?? 0,
    })))
    setHistory(
      (data ?? []).filter((w: { fecha: string }) => w.fecha !== today).reverse().slice(0, 6) as Workout[]
    )
  }

  const isDescanso = selectedType === 'descanso'
  const kcalBase = isDescanso ? 0 : ALBERTO_WORKOUTS[selectedType][intensidad]
  const condObj = CONDITIONS.find(c => c.id === condicion)!
  const previewKcal = isDescanso ? 0 : Math.round(kcalBase * condObj.multiplier * (duracion / 60))

  async function saveWorkout() {
    setSaving(true)
    const payload = {
      user_id: user!.id, fecha: today, tipo: selectedType,
      duracion_minutos: isDescanso ? 0 : duracion,
      calorias_quemadas: isDescanso ? 0 : previewKcal,
    }
    if (!IS_SUPABASE_CONFIGURED) {
      const saved = { id: workout?.id ?? crypto.randomUUID(), ...payload } as Workout
      setWorkout(saved)
      localStorage.setItem(`demo_workout_${today}`, JSON.stringify(saved))
      setSaving(false)
      return
    }
    if (workout) {
      const { data } = await supabase.from('workouts').update(payload).eq('id', workout.id).select().single()
      if (data) setWorkout(data)
    } else {
      const { data } = await supabase.from('workouts').insert(payload).select().single()
      if (data) setWorkout(data)
    }
    setSaving(false)
  }

  async function deleteWorkout() {
    if (!workout) return
    if (!IS_SUPABASE_CONFIGURED) {
      localStorage.removeItem(`demo_workout_${today}`)
      setWorkout(null); setSelectedType('boxeo_tecnica')
      setIntensidad('medio'); setCondicion('normal'); setDuracion(60)
      return
    }
    await supabase.from('workouts').delete().eq('id', workout.id)
    setWorkout(null); setSelectedType('boxeo_tecnica')
    setIntensidad('medio'); setCondicion('normal'); setDuracion(60)
  }

  function saveSteps(n: number) {
    const val = Math.max(0, n)
    setSteps(val)
    localStorage.setItem(`steps_${today}`, String(val))
  }

  function saveSleep(h: number) {
    const val = Math.max(0, Math.round(h * 2) / 2)
    setSleepHours(val)
    localStorage.setItem(`sleep_${today}`, String(val))
  }

  const kmEstimated = (steps * 0.00075).toFixed(1)
  const kcalWalking = Math.round(steps * 0.04)
  const kcalSleep = Math.round(sleepHours * 55)

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-6">
        <span className="label-caps block mb-1">Módulo 03</span>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-black text-3xl text-gray-900">ENTRENO</h1>
          {workout && (
            <div className="text-right">
              <div className="font-black text-3xl leading-none" style={{ color: '#FF6B35' }}>
                {workout.calorias_quemadas.toLocaleString()}
              </div>
              <div className="label-caps">kcal quemadas</div>
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Today's workout summary ─────────────── */}
          {workout && (
            <div className="card p-5 mb-4" style={{ backgroundImage: 'radial-gradient(ellipse at 6% 40%, rgba(255,175,140,0.44) 0%, transparent 36%), radial-gradient(ellipse at 44% 34%, rgba(170,150,232,0.50) 0%, rgba(255,130,190,0.35) 34%, transparent 58%), radial-gradient(ellipse at 88% 65%, rgba(130,156,244,0.44) 0%, rgba(150,196,244,0.35) 34%, transparent 55%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: WORKOUT_BG[workout.tipo as WorkoutType] }}>
                    {(() => { const Icon = WORKOUT_ICONS[workout.tipo as WorkoutType] ?? Zap
                      return <Icon size={22} color={WORKOUT_COLOR[workout.tipo as WorkoutType]} /> })()}
                  </div>
                  <div>
                    <span className="label-caps block mb-0.5">Entreno de hoy</span>
                    <h2 className="font-black text-lg text-gray-900">
                      {WORKOUT_TYPES[workout.tipo as WorkoutType]?.label ?? workout.tipo}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <Clock size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {workout.tipo === 'descanso' ? 'Descanso' : `${workout.duracion_minutos} min`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap size={11} style={{ color: '#FF6B35' }} />
                        <span className="text-xs font-bold" style={{ color: '#FF6B35' }}>
                          {workout.calorias_quemadas} kcal
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={deleteWorkout}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-300">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── 1. Workout type grid ────────────────── */}
          <section className="mb-4">
            <span className="label-caps block mb-3">
              {workout ? 'Cambiar entreno' : '1. Tipo de entreno'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(WORKOUT_TYPES) as WorkoutType[]).map((type) => {
                const { label } = WORKOUT_TYPES[type]
                const active = selectedType === type
                const Icon = WORKOUT_ICONS[type]
                const wData = ALBERTO_WORKOUTS[type]
                return (
                  <button key={type}
                    onClick={() => { setSelectedType(type); setDuracion(wData.duracion > 0 ? wData.duracion : 60) }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                    style={{
                      background: active ? '#1A1A1A' : '#FFFFFF',
                      boxShadow: active ? '0 4px 14px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: active ? WORKOUT_BG[type] : '#F5F5F7' }}>
                      <Icon size={18} color={active ? WORKOUT_COLOR[type] : '#9CA3AF'} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: active ? '#FFFFFF' : '#1A1A1A' }}>
                        {label}
                      </p>
                      {wData.medio > 0 && (
                        <p className="text-[10px] font-semibold mt-0.5"
                          style={{ color: active ? WORKOUT_COLOR[type] : '#9CA3AF' }}>
                          ~{wData.medio} kcal / {wData.duracion}min
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {!isDescanso && (
            <>
              {/* ── 2. Intensity selector ──────────────── */}
              <section className="mb-4">
                <span className="label-caps block mb-3">2. Intensidad del entreno</span>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(INTENSITY_CONFIG) as IntensityLevel[]).map((level) => {
                    const cfg = INTENSITY_CONFIG[level]
                    const kcal = ALBERTO_WORKOUTS[selectedType][level]
                    const active = intensidad === level
                    return (
                      <button key={level} onClick={() => setIntensidad(level)}
                        className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl transition-all"
                        style={{
                          background: active ? cfg.color : '#FFFFFF',
                          boxShadow: active ? `0 4px 14px ${cfg.color}40` : '0 1px 3px rgba(0,0,0,0.05)',
                          border: active ? 'none' : `1.5px solid ${cfg.color}30`,
                        }}
                      >
                        <span className="text-xl">{cfg.emoji}</span>
                        <span className="text-xs font-black" style={{ color: active ? '#fff' : cfg.color }}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-bold"
                          style={{ color: active ? 'rgba(255,255,255,0.85)' : '#6B7280' }}>
                          {kcal} kcal/h
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ── 3. Environmental condition ─────────── */}
              <section className="mb-4">
                <span className="label-caps block mb-3">3. Condición ambiental</span>
                <div className="grid grid-cols-3 gap-2">
                  {CONDITIONS.map((cond) => {
                    const active = condicion === cond.id
                    return (
                      <button key={cond.id} onClick={() => setCondicion(cond.id)}
                        className="flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl transition-all"
                        style={{
                          background: active ? '#1A1A1A' : '#FFFFFF',
                          boxShadow: active ? '0 4px 14px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <span className="text-xl">{cond.icon}</span>
                        <span className="text-[11px] font-black" style={{ color: active ? '#fff' : '#1A1A1A' }}>
                          {cond.label}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: active ? '#FF6B35' : '#9CA3AF' }}>
                          ×{cond.multiplier.toFixed(1)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ── 4. Duration ────────────────────────── */}
              <div className="card p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} style={{ color: '#FF6B35' }} />
                  <span className="label-caps">4. Duración</span>
                </div>
                <input
                  type="number" value={duracion}
                  onChange={(e) => setDuracion(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1" max="300"
                  className="w-full px-4 py-3 text-xl font-black rounded-xl text-center mb-2"
                  style={{ color: '#FF6B35' }}
                />
                <div className="flex gap-1.5">
                  {[30, 45, 60, 90, 120].map((m) => (
                    <button key={m} onClick={() => setDuracion(m)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all"
                      style={{
                        background: duracion === m ? '#1A1A1A' : '#F5F5F7',
                        color: duracion === m ? '#FF6B35' : '#9CA3AF',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 5. Calorie summary ─────────────────── */}
              <div className="card p-5 mb-4" style={{ background: '#FFF4EF', border: '1.5px solid #FFD4BC' }}>
                <span className="label-caps block mb-4">Resumen del cálculo</span>
                <div className="flex flex-col gap-2.5 mb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Tipo</span>
                    <span className="text-xs font-bold text-gray-800">{WORKOUT_TYPES[selectedType].label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Intensidad</span>
                    <span className="text-xs font-bold" style={{ color: INTENSITY_CONFIG[intensidad].color }}>
                      {INTENSITY_CONFIG[intensidad].emoji} {INTENSITY_CONFIG[intensidad].label} — {kcalBase} kcal/h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Condición ambiental</span>
                    <span className="text-xs font-bold text-gray-800">
                      {condObj.icon} {condObj.label} — ×{condObj.multiplier.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Duración</span>
                    <span className="text-xs font-bold text-gray-800">{duracion} min</span>
                  </div>
                  <div className="divider" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {kcalBase} × {condObj.multiplier.toFixed(1)} × ({duracion}/60)
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">= {previewKcal}</span>
                  </div>
                </div>
                <div className="text-center py-2">
                  <div className="font-black leading-none" style={{ fontSize: '3.5rem', color: '#FF6B35' }}>
                    {previewKcal.toLocaleString()}
                  </div>
                  <div className="font-black text-sm tracking-widest mt-1" style={{ color: '#FF6B35', opacity: 0.6 }}>
                    KCAL QUEMADAS
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Save button ─────────────────────────── */}
          <button onClick={saveWorkout} disabled={saving}
            className="w-full py-4 flex items-center justify-center gap-3 font-bold text-sm tracking-widest uppercase rounded-2xl mb-4 disabled:opacity-50"
            style={{ background: '#1A1A1A', color: '#ffffff' }}
          >
            <Save size={16} />
            {saving ? 'Guardando...' : workout ? 'Actualizar entreno' : 'Registrar entreno'}
          </button>

          {/* ── Pasos ──────────────────────────────── */}
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                <Footprints size={17} style={{ color: '#3B82F6' }} />
              </div>
              <div>
                <span className="label-caps block">Pasos de hoy</span>
                <span className="text-xs text-gray-400">Caminar ~0.04 kcal / paso</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="number"
                value={steps || ''}
                onChange={(e) => saveSteps(parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
                className="flex-1 px-4 py-3 text-lg font-black rounded-xl text-center"
                style={{ color: '#3B82F6' }}
              />
              <span className="text-sm font-bold text-gray-400">pasos</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-300">0</span>
              <input
                type="range"
                min="0"
                max="25000"
                step="500"
                value={steps}
                onChange={(e) => saveSteps(parseInt(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#3B82F6' }}
              />
              <span className="text-xs text-gray-300">25k</span>
            </div>
            {steps > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-xl bg-gray-50">
                  <div className="font-black text-lg leading-none text-gray-900">{steps.toLocaleString()}</div>
                  <div className="label-caps mt-1">pasos</div>
                </div>
                <div className="text-center p-2 rounded-xl bg-gray-50">
                  <div className="font-black text-lg leading-none" style={{ color: '#3B82F6' }}>{kmEstimated}</div>
                  <div className="label-caps mt-1">km</div>
                </div>
                <div className="text-center p-2 rounded-xl bg-gray-50">
                  <div className="font-black text-lg leading-none" style={{ color: '#FF6B35' }}>{kcalWalking}</div>
                  <div className="label-caps mt-1">kcal</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Sueño ──────────────────────────────── */}
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#F5F3FF' }}>
                <BedDouble size={17} style={{ color: '#8B5CF6' }} />
              </div>
              <div>
                <span className="label-caps block">Sueño de hoy</span>
                <span className="text-xs text-gray-400">~55 kcal quemadas por hora</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="number"
                value={sleepHours || ''}
                onChange={(e) => saveSleep(parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                max="12"
                step="0.5"
                className="flex-1 px-4 py-3 text-lg font-black rounded-xl text-center"
                style={{ color: '#8B5CF6' }}
              />
              <span className="text-sm font-bold text-gray-400">horas</span>
            </div>
            <div className="flex gap-1.5 mb-4">
              {[5, 6, 7, 7.5, 8, 9].map((h) => (
                <button
                  key={h}
                  onClick={() => saveSleep(h)}
                  className="flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all"
                  style={{
                    background: sleepHours === h ? '#8B5CF6' : '#F5F5F7',
                    color: sleepHours === h ? '#fff' : '#9CA3AF',
                  }}
                >
                  {h}h
                </button>
              ))}
            </div>
            {sleepHours > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-xl bg-gray-50">
                  <div className="font-black text-lg leading-none" style={{ color: '#8B5CF6' }}>{sleepHours}h</div>
                  <div className="label-caps mt-1">dormidas</div>
                </div>
                <div className="text-center p-2 rounded-xl bg-gray-50">
                  <div className="font-black text-lg leading-none" style={{ color: '#FF6B35' }}>{kcalSleep}</div>
                  <div className="label-caps mt-1">kcal</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Weekly kcal chart ───────────────────── */}
          {mounted && (
            <div className="card p-5 mb-4">
              <span className="label-caps block mb-4">Calorías quemadas esta semana</span>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12 }}
                    formatter={(val: unknown) => [`${val} kcal`, 'Quemadas']}
                  />
                  <Area type="monotone" dataKey="kcal" stroke="#FF6B35" strokeWidth={2.5}
                    fill="url(#burnGrad)" dot={{ fill: '#FF6B35', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── History last 6 days ─────────────────── */}
          {history.length > 0 && (
            <div className="card p-5">
              <span className="label-caps block mb-3">Últimas sesiones</span>
              <div className="flex flex-col gap-2">
                {history.map((w) => {
                  const Icon = WORKOUT_ICONS[w.tipo as WorkoutType] ?? Zap
                  return (
                    <div key={w.id} className="flex items-center gap-3 py-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: WORKOUT_BG[w.tipo as WorkoutType] }}>
                        <Icon size={15} color={WORKOUT_COLOR[w.tipo as WorkoutType]} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {WORKOUT_TYPES[w.tipo as WorkoutType]?.label ?? w.tipo}
                        </p>
                        <p className="text-xs text-gray-400">{w.fecha} · {w.duracion_minutos} min</p>
                      </div>
                      <div className="font-bold text-sm" style={{ color: '#FF6B35' }}>
                        {w.calorias_quemadas} kcal
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
