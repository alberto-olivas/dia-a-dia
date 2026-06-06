'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { WorkoutType, Workout } from '@/lib/types'
import { WORKOUT_TYPES } from '@/lib/types'
import { Zap, Clock, Save, Trash2 } from 'lucide-react'

export default function EntrenoPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [saving, setSaving] = useState(false)

  const [selectedType, setSelectedType] = useState<WorkoutType>('boxeo_tecnica')
  const [duracion, setDuracion] = useState<number>(60)

  useEffect(() => {
    if (!user || !IS_SUPABASE_CONFIGURED) return
    fetchWorkout()
  }, [user])

  async function fetchWorkout() {
    setLoading(true)
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('fecha', today)
      .maybeSingle()
    if (data) {
      setWorkout(data)
      setSelectedType(data.tipo as WorkoutType)
      setDuracion(data.duracion_minutos)
    }
    setLoading(false)
  }

  function calcKcal(type: WorkoutType, mins: number): number {
    const { baseKcal, baseMinutes } = WORKOUT_TYPES[type]
    if (baseMinutes === 0) return 0
    return Math.round((baseKcal * mins) / baseMinutes)
  }

  const previewKcal = calcKcal(selectedType, duracion)

  async function saveWorkout() {
    setSaving(true)
    const payload = {
      user_id: user!.id,
      fecha: today,
      tipo: selectedType,
      duracion_minutos: selectedType === 'descanso' ? 0 : duracion,
      calorias_quemadas: previewKcal,
    }

    if (workout) {
      const { data } = await supabase
        .from('workouts')
        .update(payload)
        .eq('id', workout.id)
        .select()
        .single()
      if (data) setWorkout(data)
    } else {
      const { data } = await supabase
        .from('workouts')
        .insert(payload)
        .select()
        .single()
      if (data) setWorkout(data)
    }
    setSaving(false)
  }

  async function deleteWorkout() {
    if (!workout) return
    await supabase.from('workouts').delete().eq('id', workout.id)
    setWorkout(null)
    setSelectedType('boxeo_tecnica')
    setDuracion(60)
  }

  const isDescanso = selectedType === 'descanso'

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-8">
        <span className="label-caps block mb-1">Módulo 03</span>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-black" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', color: '#ffffff', lineHeight: 1 }}>
            ENTRENO
          </h1>
          {workout && (
            <div className="text-right shrink-0">
              <div className="font-black" style={{ fontSize: '2rem', color: '#FF2D00', lineHeight: 1 }}>
                {workout.calorias_quemadas.toLocaleString()}
              </div>
              <div className="label-caps">kcal quemadas</div>
            </div>
          )}
        </div>
        <div className="w-8 h-0.5 mt-3" style={{ background: '#FF2D00' }} />
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF2D00] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Current workout summary ─────────────── */}
          {workout && (
            <div className="card p-5 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="label-caps block mb-2">Entreno registrado hoy</span>
                  <h2 className="font-black text-xl" style={{ color: '#ffffff' }}>
                    {WORKOUT_TYPES[workout.tipo as WorkoutType]?.label ?? workout.tipo}
                  </h2>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} style={{ color: '#555' }} />
                      <span className="text-sm" style={{ color: '#888' }}>
                        {workout.tipo === 'descanso' ? '—' : `${workout.duracion_minutos} min`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={12} style={{ color: '#FF2D00' }} />
                      <span className="font-bold text-sm" style={{ color: '#FF2D00' }}>
                        {workout.calorias_quemadas} kcal
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={deleteWorkout}
                  className="p-2"
                  style={{ color: '#444' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Workout type selector ───────────────── */}
          <section className="mb-6">
            <span className="label-caps block mb-3">
              {workout ? 'Cambiar tipo de entreno' : 'Selecciona el tipo de entreno'}
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(WORKOUT_TYPES) as WorkoutType[]).map((type) => {
                const { label, baseKcal, baseMinutes } = WORKOUT_TYPES[type]
                const active = selectedType === type
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type)
                      setDuracion(baseMinutes > 0 ? baseMinutes : 0)
                    }}
                    className="flex items-center justify-between px-4 py-4 text-left transition-all"
                    style={{
                      background: active ? '#1a1a1a' : '#111111',
                      border: `1px solid ${active ? '#FF2D00' : '#2a2a2a'}`,
                      borderLeft: `3px solid ${active ? '#FF2D00' : '#2a2a2a'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: active ? '#FF2D00' : '#2a2a2a' }}
                      />
                      <span className="font-bold text-sm" style={{ color: active ? '#fff' : '#888' }}>
                        {label}
                      </span>
                    </div>
                    <div className="text-right">
                      {baseKcal > 0 ? (
                        <>
                          <div className="font-black text-sm" style={{ color: active ? '#FF2D00' : '#555' }}>
                            {baseKcal} kcal
                          </div>
                          <div className="label-caps">{baseMinutes} min</div>
                        </>
                      ) : (
                        <span className="label-caps">0 kcal</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Duration & calories preview ─────────── */}
          {!isDescanso && (
            <section className="mb-6 card p-5">
              <span className="label-caps block mb-4">Ajustar duración</span>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={14} style={{ color: '#FF2D00' }} />
                    <label className="label-caps">Minutos</label>
                  </div>
                  <input
                    type="number"
                    value={duracion}
                    onChange={(e) => setDuracion(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="300"
                    className="w-full px-4 py-3 text-lg font-bold rounded-none text-center"
                  />
                  {/* Quick presets */}
                  <div className="flex gap-2 mt-2">
                    {[30, 45, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        onClick={() => setDuracion(m)}
                        className="flex-1 py-1.5 text-xs font-bold"
                        style={{
                          background: duracion === m ? '#FF2D00' : '#1a1a1a',
                          color: duracion === m ? '#fff' : '#555',
                          border: `1px solid ${duracion === m ? '#FF2D00' : '#2a2a2a'}`,
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="flex flex-col items-center justify-center w-28 h-28"
                  style={{ background: '#0a0a0a', border: '1px solid #FF2D00' }}
                >
                  <Zap size={16} style={{ color: '#FF2D00' }} />
                  <div className="font-black text-2xl mt-1" style={{ color: '#FF2D00' }}>
                    {previewKcal}
                  </div>
                  <div className="label-caps">kcal</div>
                </div>
              </div>
            </section>
          )}

          {/* ── Save button ─────────────────────────── */}
          <button
            onClick={saveWorkout}
            disabled={saving}
            className="w-full py-4 flex items-center justify-center gap-3 font-bold text-sm tracking-widest uppercase disabled:opacity-50"
            style={{ background: '#FF2D00', color: '#ffffff' }}
          >
            <Save size={16} />
            {saving ? 'Guardando...' : workout ? 'Actualizar entreno' : 'Registrar entreno'}
          </button>

          {/* ── Kcal reference ──────────────────────── */}
          <div className="mt-6 divider" />
          <div className="mt-4">
            <span className="label-caps block mb-3">Referencia de calorías (1h)</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(WORKOUT_TYPES) as [WorkoutType, typeof WORKOUT_TYPES[WorkoutType]][])
                .filter(([, v]) => v.baseKcal > 0)
                .map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between px-3 py-2" style={{ background: '#111111' }}>
                    <span className="text-xs" style={{ color: '#555' }}>{val.label}</span>
                    <span className="text-xs font-bold" style={{ color: '#FF2D00' }}>~{val.baseKcal}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
