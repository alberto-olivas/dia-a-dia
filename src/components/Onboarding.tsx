'use client'

import { useState } from 'react'
import { useProfile } from '@/lib/profile-context'
import { ChevronRight } from 'lucide-react'

const STEPS = [
  {
    num: 1,
    title: '¿Cómo quieres\nque te llame?',
    subtitle: 'Este nombre aparecerá en tu pantalla de inicio',
    field: 'nombre' as const,
    type: 'text',
    placeholder: 'Ej: Alberto',
    unit: '',
    min: undefined, max: undefined,
  },
  {
    num: 2,
    title: '¿Cuándo es\ntu cumpleaños?',
    subtitle: 'Para calcular tu edad y personalizar la app',
    field: 'fecha_nacimiento' as const,
    type: 'date',
    placeholder: '',
    unit: '',
    min: '1940-01-01', max: new Date().toISOString().split('T')[0],
  },
  {
    num: 3,
    title: '¿Cuánto\npesas ahora?',
    subtitle: 'En kilogramos. Podrás actualizarlo cuando quieras',
    field: 'peso' as const,
    type: 'number',
    placeholder: '75',
    unit: 'kg',
    min: '30', max: '250',
  },
  {
    num: 4,
    title: '¿Cuánto\nmides?',
    subtitle: 'Tu altura en centímetros',
    field: 'altura' as const,
    type: 'number',
    placeholder: '175',
    unit: 'cm',
    min: '100', max: '230',
  },
]

export default function Onboarding() {
  const { createProfile } = useProfile()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState({
    nombre: '',
    fecha_nacimiento: '',
    peso: '',
    altura: '',
  })

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const value = values[current.field]

  const canContinue = step === 0 ? value.trim().length > 0 : true

  async function handleNext() {
    if (!canContinue) return
    if (!isLast) { setStep(step + 1); return }
    setSaving(true)
    await createProfile({
      nombre: values.nombre.trim(),
      fecha_nacimiento: values.fecha_nacimiento || null,
      peso: values.peso ? parseFloat(values.peso) : null,
      altura: values.altura ? parseInt(values.altura) : null,
    })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: '#0F0F12' }}
    >
      {/* Progress dots */}
      <div className="flex gap-2 mb-12">
        {STEPS.map((_, i) => (
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

      {/* Step content */}
      <div className="w-full max-w-sm">
        <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#FF6B35' }}>
          Paso {step + 1} de {STEPS.length}
        </p>
        <h1
          className="font-black leading-tight mb-3 whitespace-pre-line"
          style={{ fontSize: '2.25rem', color: '#F9FAFB' }}
        >
          {current.title}
        </h1>
        <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
          {current.subtitle}
        </p>

        <div className="relative mb-8">
          <input
            key={current.field}
            type={current.type}
            value={value}
            onChange={(e) => setValues({ ...values, [current.field]: e.target.value })}
            placeholder={current.placeholder}
            min={current.min}
            max={current.max}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            className="w-full px-5 py-4 rounded-2xl text-2xl font-black pr-16"
            style={{
              background: '#1C1C21',
              border: '1.5px solid #2E2E35',
              color: '#F9FAFB',
              outline: 'none',
            }}
          />
          {current.unit && (
            <span
              className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-lg"
              style={{ color: '#6B7280' }}
            >
              {current.unit}
            </span>
          )}
        </div>

        <button
          onClick={handleNext}
          disabled={!canContinue || saving}
          className="w-full py-4 flex items-center justify-center gap-3 font-black text-sm tracking-widest uppercase rounded-2xl disabled:opacity-30 transition-all"
          style={{ background: '#FF6B35', color: '#FFFFFF' }}
        >
          {saving ? 'Guardando...' : isLast ? 'Empezar' : 'Siguiente'}
          {!saving && <ChevronRight size={18} />}
        </button>

        {step > 0 && !isLast && (
          <button
            onClick={() => setStep(step + 1)}
            className="w-full py-3 mt-3 text-sm font-semibold text-center"
            style={{ color: '#6B7280' }}
          >
            Saltar por ahora
          </button>
        )}
        {isLast && (
          <button
            onClick={handleNext}
            className="w-full py-3 mt-3 text-sm font-semibold text-center"
            style={{ color: '#6B7280' }}
          >
            Saltar por ahora
          </button>
        )}
      </div>
    </div>
  )
}
