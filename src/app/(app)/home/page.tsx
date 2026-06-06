'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Task, FoodEntry, Workout } from '@/lib/types'
import { ArrowRight, Flame, Zap, TrendingUp } from 'lucide-react'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function HomePage() {
  const { user } = useAuth()
  const now = useClock()
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [calories, setCalories] = useState({ consumed: 0, burned: 0 })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!user) return
    fetchTodayData()
  }, [user])

  async function fetchTodayData() {
    const [{ data: tasks }, { data: food }, { data: workout }] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user!.id)
        .in('cuando', ['hoy', 'fecha'])
        .neq('estado', 'terminada'),
      supabase
        .from('food_entries')
        .select('calorias')
        .eq('user_id', user!.id)
        .eq('fecha', today),
      supabase
        .from('workouts')
        .select('calorias_quemadas')
        .eq('user_id', user!.id)
        .eq('fecha', today),
    ])

    // Filter tasks for today
    const todayDate = today
    const filtered = (tasks ?? []).filter((t: Task) => {
      if (t.cuando === 'hoy') return true
      if (t.cuando === 'fecha' && t.fecha_objetivo === todayDate) return true
      return false
    })
    setTodayTasks(filtered)

    const consumed = (food ?? []).reduce((s: number, f: { calorias: number }) => s + f.calorias, 0)
    const burned = (workout ?? []).reduce((s: number, w: { calorias_quemadas: number }) => s + w.calorias_quemadas, 0)
    setCalories({ consumed, burned })
  }

  const dayName = DAY_NAMES[now.getDay()]
  const dayNum = now.getDate()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const netCalories = calories.consumed - calories.burned

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-10">
        <div className="flex items-start justify-between">
          <div>
            <span className="label-caps block mb-2">Sistema activo</span>
            <h1
              className="font-black leading-none tracking-tight"
              style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)', color: '#ffffff' }}
            >
              DÍA A DÍA
            </h1>
          </div>
          <div className="text-right">
            <div
              className="font-black tabular-nums"
              style={{ fontSize: '2rem', color: '#FF2D00', lineHeight: 1 }}
            >
              {hours}:{minutes}
            </div>
            <div className="label-caps mt-1">{dayName} {dayNum}</div>
          </div>
        </div>
        <div className="w-12 h-0.5 mt-4" style={{ background: '#FF2D00' }} />
      </header>

      {/* ── Calories grid ──────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="label-caps">Calorías hoy</span>
          <Link href="/alimentacion" className="label-caps flex items-center gap-1" style={{ color: '#FF2D00' }}>
            Ver <ArrowRight size={10} />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Consumed */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={12} style={{ color: '#FF2D00' }} />
              <span className="label-caps">Ingeridas</span>
            </div>
            <div className="font-black" style={{ fontSize: '1.75rem', color: '#ffffff', lineHeight: 1 }}>
              {calories.consumed.toLocaleString()}
            </div>
            <div className="label-caps mt-1">kcal</div>
          </div>

          {/* Burned */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} style={{ color: '#FF2D00' }} />
              <span className="label-caps">Quemadas</span>
            </div>
            <div className="font-black" style={{ fontSize: '1.75rem', color: '#ffffff', lineHeight: 1 }}>
              {calories.burned.toLocaleString()}
            </div>
            <div className="label-caps mt-1">kcal</div>
          </div>

          {/* Net */}
          <div className="card p-4" style={{ borderColor: netCalories > 0 ? '#2a2a2a' : '#FF2D00' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={12} style={{ color: netCalories > 0 ? '#888888' : '#FF2D00' }} />
              <span className="label-caps">Neto</span>
            </div>
            <div
              className="font-black"
              style={{
                fontSize: '1.75rem',
                color: netCalories > 2500 ? '#FF2D00' : '#ffffff',
                lineHeight: 1
              }}
            >
              {netCalories.toLocaleString()}
            </div>
            <div className="label-caps mt-1">kcal</div>
          </div>
        </div>
      </section>

      {/* ── Divider ────────────────────────────────── */}
      <div className="divider mb-8" />

      {/* ── Today tasks ────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="label-caps">Tareas de hoy</span>
          <Link href="/gestor" className="label-caps flex items-center gap-1" style={{ color: '#FF2D00' }}>
            Ver todas <ArrowRight size={10} />
          </Link>
        </div>

        {todayTasks.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm" style={{ color: '#555555' }}>Sin tareas pendientes para hoy</p>
            <Link
              href="/gestor"
              className="inline-block mt-3 px-4 py-2 text-xs font-bold tracking-widest uppercase"
              style={{ background: '#FF2D00', color: '#ffffff' }}
            >
              Añadir tarea
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 px-4 py-3"
                style={{ background: '#111111', borderLeft: '2px solid #FF2D00' }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: task.estado === 'en_proceso' ? '#FF2D00' : '#2a2a2a',
                    border: task.estado === 'en_proceso' ? 'none' : '1px solid #3a3a3a'
                  }}
                />
                <span className="text-sm font-semibold flex-1 truncate" style={{ color: '#ffffff' }}>
                  {task.nombre}
                </span>
                <span
                  className="text-xs font-bold tracking-wider uppercase shrink-0"
                  style={{ color: task.estado === 'en_proceso' ? '#FF2D00' : '#555555' }}
                >
                  {task.estado === 'por_hacer' ? 'Pendiente' : 'En proceso'}
                </span>
              </div>
            ))}
            {todayTasks.length > 5 && (
              <p className="text-xs text-center py-2" style={{ color: '#555555' }}>
                +{todayTasks.length - 5} más
              </p>
            )}
          </div>
        )}
      </section>

    </div>
  )
}
