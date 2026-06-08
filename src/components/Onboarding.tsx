'use client'

import { useState } from 'react'
import { useProfile } from '@/lib/profile-context'
import { ChevronRight, Check } from 'lucide-react'

type ActivityLevel = 'light' | 'moderate' | 'active'
type GoalType = 'deficit' | 'maintenance' | 'surplus'

function calcCalorieGoal(
  peso: number,
  altura: number,
  edad: number,
  activity: ActivityLevel,
  goal: GoalType,
): number {
  // Mifflin-St Jeor gender-neutral (promedio M/F: +5 y -161 → -78)
  const bmr = 10 * peso + 6.25 * altura - 5 * edad - 78
  const multiplier = { light: 1.375, moderate: 1.55, active: 1.725 }[activity]
  const tdee = Math.round(bmr * multiplier)
  const adj = { deficit: -400, maintenance: 0, surplus: 300 }[goal]
  return Math.max(1200, Math.round(tdee + adj))
}

const DATA_STEPS = [
  {
    title: '¿Cómo quieres\nque te llame?',
    subtitle: 'Este nombre aparecerá en tu pantalla de inicio',
    field: 'nombre' as const,
    type: 'text',
    placeholder: 'Ej: Alberto',
    unit: '',
    min: undefined, max: undefined,
  },
  {
    title: '¿Cuándo es\ntu cumpleaños?',
    subtitle: 'Para calcular tu edad y personalizar las calorías',
    field: 'fecha_nacimiento' as const,
    type: 'date',
    placeholder: '',
    unit: '',
    min: '1940-01-01', max: new Date().toISOString().split('T')[0],
  },
  {
    title: '¿Cuánto\npesas ahora?',
    subtitle: 'En kilogramos. Podrás actualizarlo cuando quieras',
    field: 'peso' as const,
    type: 'number',
    placeholder: '75',
    unit: 'kg',
    min: '30', max: '250',
  },
  {
    title: '¿Cuánto\nmides?',
    subtitle: 'Tu altura en centímetros',
    field: 'altura' as const,
    type: 'number',
    placeholder: '175',
    unit: 'cm',
    min: '100', max: '230',
  },
]

// 4 datos + actividad + objetivo + confirmación = 7 pasos
const TOTAL_STEPS = 7

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'light',    label: 'Poco activo',   desc: '1–2 días de ejercicio a la semana' },
  { value: 'moderate', label: 'Moderado',       desc: '3–5 días de ejercicio a la semana' },
  { value: 'active',   label: 'Muy activo',     desc: '6–7 días o trabajo físico intenso' },
]

const GOAL_OPTIONS: { value: GoalType; label: string; desc: string; adj: string }[] = [
  { value: 'deficit',     label: 'Déficit',         desc: 'Perder grasa o peso',          adj: '−400 kcal' },
  { value: 'maintenance', label: 'Mantenimiento',   desc: 'Mantener el peso actual',       adj: '±0 kcal'  },
  { value: 'surplus',     label: 'Superávit',       desc: 'Ganar masa muscular',           adj: '+300 kcal' },
]

export default function Onboarding() {
  const { createProfile } = useProfile()
  const [step, setStep]         = useState(0)
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState('')

  const [values, setValues] = useState({
    nombre: '',
    fecha_nacimiento: '',
    peso: '',
    altura: '',
  })

  const [activityLevel,   setActivityLevel]   = useState<ActivityLevel | null>(null)
  const [goalType,        setGoalType]         = useState<GoalType | null>(null)
  const [recommendedKcal, setRecommendedKcal] = useState<number | null>(null)
  const [showManual,      setShowManual]       = useState(false)
  const [manualInput,     setManualInput]      = useState('')

  // ── helpers ─────────────────────────────────────────
  function getAge() {
    if (!values.fecha_nacimiento) return 30
    return Math.floor((Date.now() - new Date(values.fecha_nacimiento).getTime()) / 3.15576e10)
  }

  function computeKcal(activity: ActivityLevel, goal: GoalType) {
    return calcCalorieGoal(
      parseFloat(values.peso)  || 70,
      parseInt(values.altura)  || 170,
      getAge(),
      activity,
      goal,
    )
  }

  async function doSave(kcal: number) {
    setSaving(true)
    setSaveError('')
    localStorage.setItem('calorie_goal', String(kcal))
    const err = await createProfile({
      nombre: values.nombre.trim(),
      fecha_nacimiento: values.fecha_nacimiento || null,
      peso:   values.peso   ? parseFloat(values.peso)  : null,
      altura: values.altura ? parseInt(values.altura)  : null,
    })
    setSaving(false)
    if (err) setSaveError(err)
  }

  // ── navigation ───────────────────────────────────────
  function goNext() {
    if (step < DATA_STEPS.length - 1) { setStep(step + 1); return }
    if (step === DATA_STEPS.length - 1) { setStep(step + 1); return } // → actividad
    if (step === 4) { setStep(step + 1); return }                     // → objetivo
    if (step === 5) {
      const act  = activityLevel ?? 'moderate'
      const goal = goalType      ?? 'maintenance'
      setActivityLevel(act)
      setGoalType(goal)
      setRecommendedKcal(computeKcal(act, goal))
      setStep(6)
    }
  }

  function skipStep() {
    if (step === 4) { setActivityLevel('moderate'); setStep(5); return }
    if (step === 5) {
      const act = activityLevel ?? 'moderate'
      setActivityLevel(act)
      setGoalType('maintenance')
      setRecommendedKcal(computeKcal(act, 'maintenance'))
      setStep(6)
    }
  }

  // ── canContinue ──────────────────────────────────────
  const canContinue =
    step === 0 ? values.nombre.trim().length > 0
    : step === 4 ? activityLevel !== null
    : step === 5 ? goalType !== null
    : true

  // ── render ───────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: '#0F0F12' }}
    >
      {/* Progress dots */}
      <div className="flex gap-2 mb-12">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              background: i <= step ? '#FF6B35' : '#2A2A2F',
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm">
        <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#FF6B35' }}>
          Paso {step + 1} de {TOTAL_STEPS}
        </p>

        {/* ── DATA STEPS 0-3 ────────────────────────── */}
        {step < DATA_STEPS.length && (() => {
          const cur = DATA_STEPS[step]
          const val = values[cur.field]
          return (
            <>
              <h1 className="font-black leading-tight mb-3 whitespace-pre-line" style={{ fontSize: '2.25rem', color: '#F9FAFB' }}>
                {cur.title}
              </h1>
              <p className="text-sm mb-8" style={{ color: '#6B7280' }}>{cur.subtitle}</p>

              <div className="relative mb-8">
                <input
                  key={cur.field}
                  type={cur.type}
                  value={val}
                  onChange={(e) => setValues({ ...values, [cur.field]: e.target.value })}
                  placeholder={cur.placeholder}
                  min={cur.min}
                  max={cur.max}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && canContinue && goNext()}
                  className="w-full px-5 py-4 rounded-2xl text-2xl font-black pr-16"
                  style={{ background: '#1C1C21', border: '1.5px solid #2E2E35', color: '#F9FAFB', outline: 'none' }}
                />
                {cur.unit && (
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-lg" style={{ color: '#6B7280' }}>
                    {cur.unit}
                  </span>
                )}
              </div>

              {saveError && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid #FF6B35', color: '#FF6B35' }}>
                  Error al guardar: {saveError}
                </div>
              )}

              <button
                onClick={goNext}
                disabled={!canContinue}
                className="w-full py-4 flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase rounded-2xl disabled:opacity-30 transition-all"
                style={{ background: '#FF6B35', color: '#FFFFFF' }}
              >
                Siguiente <ChevronRight size={18} />
              </button>

              {step > 0 && (
                <button onClick={() => setStep(step + 1)} className="w-full py-3 mt-3 text-sm font-semibold text-center" style={{ color: '#6B7280' }}>
                  Saltar por ahora
                </button>
              )}
            </>
          )
        })()}

        {/* ── STEP 4: ACTIVIDAD ─────────────────────── */}
        {step === 4 && (
          <>
            <h1 className="font-black leading-tight mb-3" style={{ fontSize: '2rem', color: '#F9FAFB' }}>
              ¿Cuánto ejercicio{'\n'}haces?
            </h1>
            <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
              Para calcular tu gasto calórico diario
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setActivityLevel(opt.value)}
                  className="w-full px-5 py-4 rounded-2xl text-left transition-all flex items-center gap-4"
                  style={{
                    background: activityLevel === opt.value ? 'rgba(255,107,53,0.15)' : '#1C1C21',
                    border: `1.5px solid ${activityLevel === opt.value ? '#FF6B35' : '#2E2E35'}`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2"
                    style={{ borderColor: activityLevel === opt.value ? '#FF6B35' : '#4B5563', background: activityLevel === opt.value ? '#FF6B35' : 'transparent' }}
                  >
                    {activityLevel === opt.value && <Check size={10} color="#fff" />}
                  </div>
                  <div>
                    <p className="font-black text-sm" style={{ color: '#F9FAFB' }}>{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={!canContinue}
              className="w-full py-4 flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase rounded-2xl disabled:opacity-30 transition-all"
              style={{ background: '#FF6B35', color: '#FFFFFF' }}
            >
              Siguiente <ChevronRight size={18} />
            </button>
            <button onClick={skipStep} className="w-full py-3 mt-3 text-sm font-semibold text-center" style={{ color: '#6B7280' }}>
              Saltar (usaré moderado)
            </button>
          </>
        )}

        {/* ── STEP 5: OBJETIVO ──────────────────────── */}
        {step === 5 && (
          <>
            <h1 className="font-black leading-tight mb-3" style={{ fontSize: '2rem', color: '#F9FAFB' }}>
              ¿Cuál es tu{'\n'}objetivo?
            </h1>
            <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
              Ajustaremos las calorías diarias recomendadas
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGoalType(opt.value)}
                  className="w-full px-5 py-4 rounded-2xl text-left transition-all flex items-center gap-4"
                  style={{
                    background: goalType === opt.value ? 'rgba(255,107,53,0.15)' : '#1C1C21',
                    border: `1.5px solid ${goalType === opt.value ? '#FF6B35' : '#2E2E35'}`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2"
                    style={{ borderColor: goalType === opt.value ? '#FF6B35' : '#4B5563', background: goalType === opt.value ? '#FF6B35' : 'transparent' }}
                  >
                    {goalType === opt.value && <Check size={10} color="#fff" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-sm" style={{ color: '#F9FAFB' }}>{opt.label}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2A2A2F', color: '#9CA3AF' }}>{opt.adj}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={!canContinue}
              className="w-full py-4 flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase rounded-2xl disabled:opacity-30 transition-all"
              style={{ background: '#FF6B35', color: '#FFFFFF' }}
            >
              Ver recomendación <ChevronRight size={18} />
            </button>
            <button onClick={skipStep} className="w-full py-3 mt-3 text-sm font-semibold text-center" style={{ color: '#6B7280' }}>
              Saltar (usaré mantenimiento)
            </button>
          </>
        )}

        {/* ── STEP 6: RECOMENDACIÓN ─────────────────── */}
        {step === 6 && (() => {
          const kcal = recommendedKcal ?? 2500
          const goalLabel = GOAL_OPTIONS.find(g => g.value === goalType)?.label ?? 'Mantenimiento'
          const actLabel  = ACTIVITY_OPTIONS.find(a => a.value === activityLevel)?.label ?? 'Moderado'
          return (
            <>
              <h1 className="font-black leading-tight mb-3" style={{ fontSize: '2rem', color: '#F9FAFB' }}>
                Tu objetivo{'\n'}recomendado
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
                Basado en tus datos, actividad y objetivo
              </p>

              {/* Recommendation card */}
              <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: 'rgba(255,107,53,0.12)', border: '1.5px solid rgba(255,107,53,0.4)' }}>
                <p className="text-5xl font-black mb-1" style={{ color: '#FF6B35' }}>
                  {kcal.toLocaleString()}
                </p>
                <p className="text-sm font-bold" style={{ color: '#F9FAFB' }}>kcal / día</p>
                <div className="flex justify-center gap-3 mt-4">
                  <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: '#2A2A2F', color: '#9CA3AF' }}>{actLabel}</span>
                  <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: '#2A2A2F', color: '#9CA3AF' }}>{goalLabel}</span>
                </div>
              </div>

              {saveError && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid #FF6B35', color: '#FF6B35' }}>
                  Error al guardar: {saveError}
                </div>
              )}

              {!showManual ? (
                <>
                  <button
                    onClick={() => doSave(kcal)}
                    disabled={saving}
                    className="w-full py-4 flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase rounded-2xl disabled:opacity-50 transition-all"
                    style={{ background: '#FF6B35', color: '#FFFFFF' }}
                  >
                    {saving ? 'Guardando...' : 'De acuerdo, empezar'}
                    {!saving && <ChevronRight size={18} />}
                  </button>
                  <button
                    onClick={() => { setShowManual(true); setManualInput(String(kcal)) }}
                    className="w-full py-3 mt-3 text-sm font-semibold text-center"
                    style={{ color: '#6B7280' }}
                  >
                    Prefiero introducirlo yo
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold mb-2" style={{ color: '#9CA3AF' }}>Introduce tus kcal diarias</p>
                  <div className="relative mb-4">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      autoFocus
                      className="w-full px-5 py-4 rounded-2xl text-2xl font-black pr-20 text-center"
                      style={{ background: '#1C1C21', border: '1.5px solid #FF6B35', color: '#FF6B35', outline: 'none' }}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: '#6B7280' }}>kcal</span>
                  </div>
                  <button
                    onClick={() => {
                      const v = parseInt(manualInput)
                      if (!isNaN(v) && v >= 500) doSave(v)
                    }}
                    disabled={saving || !manualInput || parseInt(manualInput) < 500}
                    className="w-full py-4 flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase rounded-2xl disabled:opacity-30 transition-all"
                    style={{ background: '#FF6B35', color: '#FFFFFF' }}
                  >
                    {saving ? 'Guardando...' : 'Guardar y empezar'}
                    {!saving && <ChevronRight size={18} />}
                  </button>
                  <button onClick={() => setShowManual(false)} className="w-full py-3 mt-3 text-sm font-semibold text-center" style={{ color: '#6B7280' }}>
                    Volver a la recomendación
                  </button>
                </>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
