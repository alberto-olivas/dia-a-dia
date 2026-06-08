'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { FoodEntry, MealSection } from '@/lib/types'
import { MEAL_LABELS } from '@/lib/types'
import { Plus, Trash2, Search, X, ChevronDown, ChevronUp, Flame } from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

const MEAL_ORDER: MealSection[] = ['desayuno', 'almuerzo', 'comida', 'pre_entreno', 'post_entreno', 'cena']
const MEAL_COLORS: Record<MealSection, string> = {
  desayuno: '#FF6B35',
  almuerzo: '#FF8C5A',
  comida: '#FFA878',
  pre_entreno: '#FFBE9E',
  post_entreno: '#FFD4BC',
  cena: '#FFE8DA',
}

const DEFAULT_KCAL_GOAL = 2500

function getLast7Days(): Array<{ date: string; label: string }> {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      date: d.toISOString().split('T')[0],
      label: i === 6 ? 'Hoy' : days[d.getDay()],
    }
  })
}

interface OFFProduct {
  product_name: string
  product_name_es?: string
  is_liquid?: boolean
  default_portion?: number
  nutriments: {
    'energy-kcal_100g'?: number
    'energy-kj_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
}

export default function AlimentacionPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const realToday = new Date().toISOString().split('T')[0]
  const paramDate = searchParams.get('date')
  const today = (paramDate && paramDate <= realToday) ? paramDate : realToday
  const isViewingPast = today !== realToday
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [openSection, setOpenSection] = useState<MealSection | null>('desayuno')
  const [addingTo, setAddingTo] = useState<MealSection | null>(null)
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; kcal: number }>>([])
  const [mounted, setMounted] = useState(false)
  const [kcalGoal, setKcalGoal] = useState(DEFAULT_KCAL_GOAL)

  useEffect(() => {
    setMounted(true)
    const saved = parseInt(localStorage.getItem('calorie_goal') ?? '') || DEFAULT_KCAL_GOAL
    setKcalGoal(saved)
  }, [])

  useEffect(() => {
    if (!user) return
    if (!IS_SUPABASE_CONFIGURED) {
      try {
        const saved = JSON.parse(localStorage.getItem(`demo_food_${today}`) ?? '[]')
        setEntries(saved)
      } catch {}
      setLoading(false)
      return
    }
    fetchEntries()
    fetchWeeklyData()
  }, [user])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user!.id)
      .eq('fecha', today)
      .order('timestamp', { ascending: true })
    setEntries(data ?? [])
    setLoading(false)
  }

  async function fetchWeeklyData() {
    const last7 = getLast7Days()
    const { data } = await supabase
      .from('food_entries')
      .select('fecha, calorias')
      .eq('user_id', user!.id)
      .in('fecha', last7.map((d) => d.date))

    setWeeklyData(last7.map(({ date, label }) => ({
      day: label,
      kcal: (data ?? [])
        .filter((e: { fecha: string; calorias: number }) => e.fecha === date)
        .reduce((s: number, e: { calorias: number }) => s + e.calorias, 0),
    })))
  }

  async function deleteEntry(id: string) {
    if (!IS_SUPABASE_CONFIGURED) {
      const saved = entries.filter((x) => x.id !== id)
      setEntries(saved)
      localStorage.setItem(`demo_food_${today}`, JSON.stringify(saved))
      return
    }
    await supabase.from('food_entries').delete().eq('id', id)
    setEntries((e) => e.filter((x) => x.id !== id))
  }

  async function addEntry(section: MealSection, nombre: string, gramos: number, kcal: number) {
    if (!IS_SUPABASE_CONFIGURED) {
      const newEntry: FoodEntry = {
        id: crypto.randomUUID(),
        user_id: user!.id,
        fecha: today,
        apartado: section,
        nombre_alimento: nombre,
        cantidad_gramos: gramos,
        calorias: kcal,
        timestamp: new Date().toISOString(),
      }
      const saved = [...entries, newEntry]
      setEntries(saved)
      localStorage.setItem(`demo_food_${today}`, JSON.stringify(saved))
      setAddingTo(null)
      return
    }
    const { data } = await supabase.from('food_entries').insert({
      user_id: user!.id,
      fecha: today,
      apartado: section,
      nombre_alimento: nombre,
      cantidad_gramos: gramos,
      calorias: kcal,
      timestamp: new Date().toISOString(),
    }).select().single()
    if (data) setEntries((e) => [...e, data])
    setAddingTo(null)
  }

  const totalKcal = entries.reduce((s, e) => s + e.calorias, 0)
  const progressPct = Math.min(100, (totalKcal / kcalGoal) * 100)

  const mealChartData = MEAL_ORDER.map((section) => ({
    meal: MEAL_LABELS[section].slice(0, 5),
    kcal: entries.filter((e) => e.apartado === section).reduce((s, e) => s + e.calorias, 0),
    fill: MEAL_COLORS[section],
  }))

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-6">
        <span className="label-caps block mb-1">Módulo 02</span>
        <h1 className="font-black text-3xl" style={{ color: 'var(--app-color)' }}>ALIMENTACIÓN</h1>
        {isViewingPast && (
          <div
            className="flex items-center justify-between mt-3 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)' }}
          >
            <span className="text-xs font-bold" style={{ color: '#FF6B35' }}>
              {new Date(today + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <a href="/alimentacion" className="text-xs font-bold" style={{ color: '#FF6B35' }}>
              Ir a hoy →
            </a>
          </div>
        )}
      </header>

      {/* ── Calorie progress card ──────────────────── */}
      <div className="card p-5 mb-4" style={{ backgroundImage: 'radial-gradient(ellipse at 14% 16%, rgba(255,212,148,0.55) 0%, transparent 42%), radial-gradient(ellipse at 28% 52%, rgba(255,150,175,0.48) 0%, transparent 42%), radial-gradient(ellipse at 66% 65%, rgba(192,174,242,0.42) 0%, transparent 42%), radial-gradient(ellipse at 86% 86%, rgba(148,206,244,0.48) 0%, transparent 36%)' }}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="label-caps block mb-1">Total consumido</span>
            <div className="flex items-end gap-2">
              <span className="font-black text-4xl leading-none text-gray-900">
                {totalKcal.toLocaleString()}
              </span>
              <span className="font-bold text-gray-400 mb-1">/ {kcalGoal.toLocaleString()} kcal</span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-black text-2xl leading-none" style={{ color: '#FF6B35' }}>
              {Math.round(progressPct)}%
            </span>
            <span className="label-caps block">del objetivo</span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100">
          <div
            className="h-2.5 rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: progressPct >= 100 ? '#EF4444' : 'linear-gradient(90deg, #FF6B35, #FF8C5A)',
            }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#FF6B35' }} />
            <span className="text-xs text-gray-400">Ingeridas: <b className="text-gray-700">{totalKcal}</b></span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <span className="text-xs text-gray-400">Restante: <b className="text-gray-700">{Math.max(0, kcalGoal - totalKcal)}</b></span>
          </div>
        </div>
      </div>

      {/* ── Meal bar chart ─────────────────────────── */}
      {mounted && (
        <div className="card p-5 mb-4">
          <span className="label-caps block mb-4">Calorías por comida</span>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={mealChartData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="meal"
                tick={{ fontSize: 9, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                formatter={(val: unknown) => [`${val} kcal`, '']}
              />
              <Bar dataKey="kcal" fill="#FF6B35" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Steps card ─────────────────────────────── */}
      {/* ── Meal sections accordion ────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {MEAL_ORDER.map((section) => {
            const sectionEntries = entries.filter((e) => e.apartado === section)
            const sectionKcal = sectionEntries.reduce((s, e) => s + e.calorias, 0)
            const isOpen = openSection === section

            return (
              <div key={section} className="card overflow-hidden">
                <button
                  onClick={() => setOpenSection(isOpen ? null : section)}
                  className="w-full flex items-center justify-between px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: isOpen ? '#FF6B35' : '#E5E7EB' }}
                    />
                    <span
                      className="font-bold text-sm uppercase tracking-wider"
                      style={{ color: isOpen ? '#1A1A1A' : '#9CA3AF' }}
                    >
                      {MEAL_LABELS[section]}
                    </span>
                    {sectionEntries.length > 0 && (
                      <span className="text-xs text-gray-400">{sectionEntries.length} alim.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {sectionKcal > 0 && (
                      <span className="font-bold text-sm" style={{ color: '#FF6B35' }}>
                        {sectionKcal} kcal
                      </span>
                    )}
                    {isOpen
                      ? <ChevronUp size={14} className="text-gray-300" />
                      : <ChevronDown size={14} className="text-gray-300" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    {sectionEntries.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2 mb-4">
                        {sectionEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate text-gray-800">
                                {entry.nombre_alimento}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{entry.cantidad_gramos}{LIQUID_FOOD_NAMES.has(entry.nombre_alimento.toLowerCase()) ? 'ml' : 'g'}</p>
                            </div>
                            <span className="font-bold text-sm shrink-0" style={{ color: '#FF6B35' }}>
                              {entry.calorias} kcal
                            </span>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-300"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {addingTo === section ? (
                      <FoodSearchPanel
                        onAdd={(nombre, gramos, kcal) => addEntry(section, nombre, gramos, kcal)}
                        onClose={() => setAddingTo(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingTo(section)}
                        className="mt-2 flex items-center gap-2 text-xs font-bold tracking-widest uppercase py-2.5 px-4 rounded-xl w-full justify-center"
                        style={{ border: '1.5px dashed #FFD4BC', color: '#FF6B35' }}
                      >
                        <Plus size={12} /> Añadir alimento
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Weekly area chart ──────────────────────── */}
      {mounted && (
        <div className="card p-5">
          <span className="label-caps block mb-4">Calorías esta semana</span>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="kcalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12 }}
                formatter={(val: unknown) => [`${val} kcal`, 'Calorías']}
              />
              <Area
                type="monotone"
                dataKey="kcal"
                stroke="#FF6B35"
                strokeWidth={2.5}
                fill="url(#kcalGrad)"
                dot={{ fill: '#FF6B35', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ── FoodSearchPanel ────────────────────────────── */

interface FoodSearchPanelProps {
  onAdd: (nombre: string, gramos: number, kcal: number) => void
  onClose: () => void
}


// Base de datos personal de Alberto — máxima prioridad en búsquedas
const LOCAL_FOODS: OFFProduct[] = [
  // BEBIDAS (líquidas)
  { product_name: 'Café solo', is_liquid: true, default_portion: 100, nutriments: { 'energy-kcal_100g': 2, proteins_100g: 0.1, carbohydrates_100g: 0, fat_100g: 0 } },
  { product_name: 'Café con bebida de soja sin azúcar', is_liquid: true, default_portion: 200, nutriments: { 'energy-kcal_100g': 20, proteins_100g: 1.5, carbohydrates_100g: 0.6, fat_100g: 0.9 } },
  { product_name: 'Bebida de soja sin azúcar', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 33, proteins_100g: 3.3, carbohydrates_100g: 0.7, fat_100g: 1.8 } },
  { product_name: 'Bebida de avena', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 45, proteins_100g: 1.0, carbohydrates_100g: 6.5, fat_100g: 1.5 } },
  { product_name: 'Leche semidesnatada', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 47, proteins_100g: 3.4, carbohydrates_100g: 4.8, fat_100g: 1.6 } },
  { product_name: 'Isotónica casera agua limón sal miel', is_liquid: true, default_portion: 750, nutriments: { 'energy-kcal_100g': 12, proteins_100g: 0, carbohydrates_100g: 3, fat_100g: 0 } },
  { product_name: 'Salsa de soja', is_liquid: true, default_portion: 15, nutriments: { 'energy-kcal_100g': 53, proteins_100g: 8, carbohydrates_100g: 4.9, fat_100g: 0.6 } },
  { product_name: 'Coca Cola Zero', is_liquid: true, default_portion: 330, nutriments: { 'energy-kcal_100g': 1, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
  { product_name: 'Monster Ultra', is_liquid: true, default_portion: 500, nutriments: { 'energy-kcal_100g': 3, proteins_100g: 0, carbohydrates_100g: 0.8, fat_100g: 0 } },
  // LECHES (líquidas)
  { product_name: 'Leche Nirmak entera', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 62, proteins_100g: 3.1, carbohydrates_100g: 4.8, fat_100g: 3.5 } },
  { product_name: 'Leche Nirmak semidesnatada', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 47, proteins_100g: 3.2, carbohydrates_100g: 4.8, fat_100g: 1.6 } },
  { product_name: 'Leche Nirmak desnatada', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 35, proteins_100g: 3.4, carbohydrates_100g: 4.9, fat_100g: 0.2 } },
  { product_name: 'Leche sin lactosa semidesnatada', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 46, proteins_100g: 3.2, carbohydrates_100g: 4.8, fat_100g: 1.5 } },
  { product_name: 'Leche alta proteína', is_liquid: true, default_portion: 250, nutriments: { 'energy-kcal_100g': 50, proteins_100g: 5.5, carbohydrates_100g: 4.5, fat_100g: 1.5 } },
  { product_name: 'Leche chocolate proteica', is_liquid: true, default_portion: 330, nutriments: { 'energy-kcal_100g': 63, proteins_100g: 6, carbohydrates_100g: 5.5, fat_100g: 1.8 } },
  // DESAYUNOS / ENDULZANTES
  { product_name: 'ColaCao original polvo', default_portion: 15, nutriments: { 'energy-kcal_100g': 376, proteins_100g: 6, carbohydrates_100g: 78, fat_100g: 2.4 } },
  { product_name: 'Nesquik cacao polvo', default_portion: 15, nutriments: { 'energy-kcal_100g': 379, proteins_100g: 4.9, carbohydrates_100g: 83, fat_100g: 3.0 } },
  { product_name: 'Eritritol', default_portion: 5, nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
  { product_name: 'Miel', default_portion: 10, nutriments: { 'energy-kcal_100g': 304, proteins_100g: 0.3, carbohydrates_100g: 82, fat_100g: 0 } },
  { product_name: 'Azúcar blanco', default_portion: 5, nutriments: { 'energy-kcal_100g': 400, proteins_100g: 0, carbohydrates_100g: 100, fat_100g: 0 } },
  // SUPLEMENTOS
  { product_name: 'HSN Evolate 2.0 Whey Isolate CFM', default_portion: 30, nutriments: { 'energy-kcal_100g': 383, proteins_100g: 90, carbohydrates_100g: 3.3, fat_100g: 1.5 } },
  { product_name: 'Whey protein genérica concentrada', default_portion: 30, nutriments: { 'energy-kcal_100g': 400, proteins_100g: 80, carbohydrates_100g: 7, fat_100g: 6 } },
  { product_name: 'Creatina monohidrato', default_portion: 5, nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
  { product_name: 'Citrulina malato', default_portion: 6, nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
  // LÁCTEOS
  { product_name: 'Yogur griego natural sin azúcar', default_portion: 200, nutriments: { 'energy-kcal_100g': 97, proteins_100g: 9, carbohydrates_100g: 3.5, fat_100g: 5 } },
  { product_name: 'Yogur natural 0%', default_portion: 125, nutriments: { 'energy-kcal_100g': 56, proteins_100g: 5.5, carbohydrates_100g: 4, fat_100g: 0.2 } },
  { product_name: 'Queso fresco batido 0%', default_portion: 200, nutriments: { 'energy-kcal_100g': 50, proteins_100g: 8, carbohydrates_100g: 4, fat_100g: 0.2 } },
  { product_name: 'Queso mozzarella rallado', default_portion: 40, nutriments: { 'energy-kcal_100g': 280, proteins_100g: 24, carbohydrates_100g: 2, fat_100g: 20 } },
  { product_name: 'Queso cheddar', default_portion: 20, nutriments: { 'energy-kcal_100g': 403, proteins_100g: 25, carbohydrates_100g: 1.3, fat_100g: 33 } },
  { product_name: 'Kéfir natural', default_portion: 250, nutriments: { 'energy-kcal_100g': 63, proteins_100g: 3.5, carbohydrates_100g: 4.7, fat_100g: 3.3 } },
  { product_name: 'Skyr natural', default_portion: 170, nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } },
  { product_name: 'Requesón', default_portion: 150, nutriments: { 'energy-kcal_100g': 98, proteins_100g: 11, carbohydrates_100g: 3, fat_100g: 4 } },
  { product_name: 'Queso de cabra', default_portion: 40, nutriments: { 'energy-kcal_100g': 364, proteins_100g: 22, carbohydrates_100g: 0, fat_100g: 30 } },
  { product_name: 'Queso manchego', default_portion: 40, nutriments: { 'energy-kcal_100g': 410, proteins_100g: 25, carbohydrates_100g: 1, fat_100g: 34 } },
  { product_name: 'Queso feta', default_portion: 50, nutriments: { 'energy-kcal_100g': 265, proteins_100g: 14, carbohydrates_100g: 4, fat_100g: 21 } },
  { product_name: 'Queso parmesano', default_portion: 15, nutriments: { 'energy-kcal_100g': 431, proteins_100g: 38, carbohydrates_100g: 4, fat_100g: 29 } },
  { product_name: 'Queso crema', default_portion: 30, nutriments: { 'energy-kcal_100g': 342, proteins_100g: 6, carbohydrates_100g: 4, fat_100g: 34 } },
  { product_name: 'Queso havarti', default_portion: 40, nutriments: { 'energy-kcal_100g': 371, proteins_100g: 23, carbohydrates_100g: 1, fat_100g: 31 } },
  { product_name: 'Queso light', default_portion: 40, nutriments: { 'energy-kcal_100g': 200, proteins_100g: 30, carbohydrates_100g: 3, fat_100g: 7 } },
  // CEREALES
  { product_name: 'Avena en copos', default_portion: 40, nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9, carbohydrates_100g: 66, fat_100g: 6.9 } },
  { product_name: 'Crema de arroz', default_portion: 50, nutriments: { 'energy-kcal_100g': 370, proteins_100g: 7, carbohydrates_100g: 82, fat_100g: 1 } },
  { product_name: 'Arroz blanco cocido', default_portion: 250, nutriments: { 'energy-kcal_100g': 130, proteins_100g: 2.7, carbohydrates_100g: 28, fat_100g: 0.3 } },
  { product_name: 'Arroz integral cocido', default_portion: 250, nutriments: { 'energy-kcal_100g': 112, proteins_100g: 2.6, carbohydrates_100g: 23, fat_100g: 0.9 } },
  { product_name: 'Pasta blanca cocida', default_portion: 250, nutriments: { 'energy-kcal_100g': 158, proteins_100g: 5.8, carbohydrates_100g: 31, fat_100g: 0.9 } },
  { product_name: 'Pasta integral cocida', default_portion: 250, nutriments: { 'energy-kcal_100g': 145, proteins_100g: 5.5, carbohydrates_100g: 28, fat_100g: 1.1 } },
  // PANES
  { product_name: 'Pan de centeno', default_portion: 80, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 8.5, carbohydrates_100g: 48, fat_100g: 3.3 } },
  { product_name: 'Pan integral', default_portion: 80, nutriments: { 'energy-kcal_100g': 247, proteins_100g: 9, carbohydrates_100g: 41, fat_100g: 4.2 } },
  { product_name: 'Pan blanco', default_portion: 100, nutriments: { 'energy-kcal_100g': 265, proteins_100g: 9, carbohydrates_100g: 49, fat_100g: 3.2 } },
  { product_name: 'Tortitas de trigo para fajitas', default_portion: 60, nutriments: { 'energy-kcal_100g': 310, proteins_100g: 8, carbohydrates_100g: 52, fat_100g: 8 } },
  { product_name: 'Tortitas de maíz', default_portion: 35, nutriments: { 'energy-kcal_100g': 218, proteins_100g: 5.7, carbohydrates_100g: 45, fat_100g: 2.9 } },
  { product_name: 'Pan brioche hamburguesa', default_portion: 80, nutriments: { 'energy-kcal_100g': 330, proteins_100g: 9, carbohydrates_100g: 50, fat_100g: 10 } },
  // SALSAS / GRASAS
  { product_name: 'Base de pizza casera yogur-huevo', default_portion: 250, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 11, carbohydrates_100g: 18, fat_100g: 6 } },
  { product_name: 'Tomate triturado sin azúcar', default_portion: 60, nutriments: { 'energy-kcal_100g': 32, proteins_100g: 1.4, carbohydrates_100g: 5, fat_100g: 0.2 } },
  { product_name: 'Tomate frito', default_portion: 60, nutriments: { 'energy-kcal_100g': 80, proteins_100g: 1.5, carbohydrates_100g: 10, fat_100g: 3.5 } },
  { product_name: 'Salsa yogur griego', default_portion: 50, nutriments: { 'energy-kcal_100g': 90, proteins_100g: 6, carbohydrates_100g: 4, fat_100g: 5 } },
  { product_name: 'Mayonesa', default_portion: 15, nutriments: { 'energy-kcal_100g': 680, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 75 } },
  { product_name: 'Ketchup', default_portion: 15, nutriments: { 'energy-kcal_100g': 110, proteins_100g: 1.3, carbohydrates_100g: 25, fat_100g: 0.1 } },
  { product_name: 'Mostaza', default_portion: 15, nutriments: { 'energy-kcal_100g': 66, proteins_100g: 4.4, carbohydrates_100g: 5.8, fat_100g: 3.3 } },
  { product_name: 'Guacamole', default_portion: 50, nutriments: { 'energy-kcal_100g': 160, proteins_100g: 2, carbohydrates_100g: 8, fat_100g: 14 } },
  { product_name: 'Aceite de oliva virgen extra', default_portion: 10, nutriments: { 'energy-kcal_100g': 884, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 100 } },
  { product_name: 'Aguacate', default_portion: 75, nutriments: { 'energy-kcal_100g': 160, proteins_100g: 2, carbohydrates_100g: 8.5, fat_100g: 14.7 } },
  // CARNES
  { product_name: 'Pechuga de pollo cruda', default_portion: 150, nutriments: { 'energy-kcal_100g': 110, proteins_100g: 23, carbohydrates_100g: 0, fat_100g: 1.5 } },
  { product_name: 'Pechuga de pollo a la air fryer', default_portion: 150, nutriments: { 'energy-kcal_100g': 165, proteins_100g: 31, carbohydrates_100g: 0, fat_100g: 3.6 } },
  { product_name: 'Hamburguesa de pollo a la air fryer', default_portion: 120, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 22, carbohydrates_100g: 3, fat_100g: 8 } },
  { product_name: 'Hamburguesa de ternera', default_portion: 125, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 17, carbohydrates_100g: 2, fat_100g: 19 } },
  { product_name: 'Carne picada de ternera 5% grasa', default_portion: 250, nutriments: { 'energy-kcal_100g': 137, proteins_100g: 21, carbohydrates_100g: 0, fat_100g: 5 } },
  { product_name: 'Carne picada de ternera 10% grasa', default_portion: 250, nutriments: { 'energy-kcal_100g': 176, proteins_100g: 20, carbohydrates_100g: 0, fat_100g: 10 } },
  { product_name: 'Carne picada mixta', default_portion: 250, nutriments: { 'energy-kcal_100g': 240, proteins_100g: 17, carbohydrates_100g: 0, fat_100g: 19 } },
  { product_name: 'Filete de ternera', default_portion: 180, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 22, carbohydrates_100g: 0, fat_100g: 8 } },
  { product_name: 'Solomillo de ternera', default_portion: 180, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 22, carbohydrates_100g: 0, fat_100g: 11 } },
  { product_name: 'Lomo de cerdo', default_portion: 150, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 21, carbohydrates_100g: 0, fat_100g: 10 } },
  { product_name: 'Solomillo de cerdo', default_portion: 180, nutriments: { 'energy-kcal_100g': 143, proteins_100g: 21, carbohydrates_100g: 0, fat_100g: 6 } },
  { product_name: 'Pavo filetes', default_portion: 150, nutriments: { 'energy-kcal_100g': 105, proteins_100g: 24, carbohydrates_100g: 0, fat_100g: 1 } },
  { product_name: 'Jamón cocido', default_portion: 50, nutriments: { 'energy-kcal_100g': 115, proteins_100g: 18, carbohydrates_100g: 2, fat_100g: 4 } },
  { product_name: 'Jamón serrano', default_portion: 40, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 30, carbohydrates_100g: 0, fat_100g: 14 } },
  { product_name: 'Bacon', default_portion: 30, nutriments: { 'energy-kcal_100g': 541, proteins_100g: 37, carbohydrates_100g: 1.4, fat_100g: 42 } },
  { product_name: 'Salchichas tipo Frankfurt', default_portion: 100, nutriments: { 'energy-kcal_100g': 290, proteins_100g: 12, carbohydrates_100g: 3, fat_100g: 26 } },
  { product_name: 'Salchichas frescas pollo/pavo', default_portion: 120, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 18, carbohydrates_100g: 2, fat_100g: 11 } },
  { product_name: 'Entrecot de ternera', default_portion: 250, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 20, carbohydrates_100g: 0, fat_100g: 19 } },
  { product_name: 'Chuleta de cerdo', default_portion: 220, nutriments: { 'energy-kcal_100g': 231, proteins_100g: 21, carbohydrates_100g: 0, fat_100g: 16 } },
  { product_name: 'Costillas BBQ', default_portion: 300, nutriments: { 'energy-kcal_100g': 320, proteins_100g: 20, carbohydrates_100g: 6, fat_100g: 24 } },
  { product_name: 'Pollo empanado air fryer', default_portion: 200, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 20, carbohydrates_100g: 12, fat_100g: 12 } },
  { product_name: 'Nuggets de pollo', default_portion: 120, nutriments: { 'energy-kcal_100g': 270, proteins_100g: 15, carbohydrates_100g: 20, fat_100g: 15 } },
  { product_name: 'Albóndigas de ternera', default_portion: 250, nutriments: { 'energy-kcal_100g': 240, proteins_100g: 17, carbohydrates_100g: 8, fat_100g: 16 } },
  { product_name: 'Kebab carne', default_portion: 200, nutriments: { 'energy-kcal_100g': 215, proteins_100g: 15, carbohydrates_100g: 4, fat_100g: 15 } },
  { product_name: 'Pulled pork', default_portion: 200, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 20, carbohydrates_100g: 5, fat_100g: 16 } },
  { product_name: 'Pollo asado', default_portion: 250, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 25, carbohydrates_100g: 0, fat_100g: 9 } },
  { product_name: 'Muslos de pollo', default_portion: 250, nutriments: { 'energy-kcal_100g': 215, proteins_100g: 18, carbohydrates_100g: 0, fat_100g: 15 } },
  // EMBUTIDOS
  { product_name: 'Pechuga de pavo lonchas', default_portion: 80, nutriments: { 'energy-kcal_100g': 105, proteins_100g: 20, carbohydrates_100g: 3, fat_100g: 1.5 } },
  { product_name: 'Chorizo', default_portion: 40, nutriments: { 'energy-kcal_100g': 455, proteins_100g: 24, carbohydrates_100g: 2, fat_100g: 38 } },
  { product_name: 'Salchichón', default_portion: 40, nutriments: { 'energy-kcal_100g': 430, proteins_100g: 22, carbohydrates_100g: 1, fat_100g: 36 } },
  { product_name: 'Fuet', default_portion: 40, nutriments: { 'energy-kcal_100g': 470, proteins_100g: 24, carbohydrates_100g: 2, fat_100g: 40 } },
  { product_name: 'Mortadela', default_portion: 60, nutriments: { 'energy-kcal_100g': 311, proteins_100g: 14, carbohydrates_100g: 3, fat_100g: 27 } },
  { product_name: 'Lomo embuchado', default_portion: 40, nutriments: { 'energy-kcal_100g': 320, proteins_100g: 42, carbohydrates_100g: 1, fat_100g: 16 } },
  { product_name: 'Cecina', default_portion: 40, nutriments: { 'energy-kcal_100g': 255, proteins_100g: 39, carbohydrates_100g: 1, fat_100g: 9 } },
  { product_name: 'Pepperoni', default_portion: 30, nutriments: { 'energy-kcal_100g': 494, proteins_100g: 23, carbohydrates_100g: 1, fat_100g: 44 } },
  // HUEVOS
  { product_name: 'Huevos', default_portion: 120, nutriments: { 'energy-kcal_100g': 143, proteins_100g: 12.6, carbohydrates_100g: 0.7, fat_100g: 9.5 } },
  { product_name: 'Claras de huevo', default_portion: 200, nutriments: { 'energy-kcal_100g': 52, proteins_100g: 11, carbohydrates_100g: 0.7, fat_100g: 0.2 } },
  // PESCADOS Y MARISCO
  { product_name: 'Salmón crudo', default_portion: 150, nutriments: { 'energy-kcal_100g': 208, proteins_100g: 20, carbohydrates_100g: 0, fat_100g: 13 } },
  { product_name: 'Salmón a la plancha', default_portion: 150, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 22, carbohydrates_100g: 0, fat_100g: 14 } },
  { product_name: 'Atún en lata al natural escurrido', default_portion: 80, nutriments: { 'energy-kcal_100g': 116, proteins_100g: 26, carbohydrates_100g: 0, fat_100g: 1 } },
  { product_name: 'Atún en lata en aceite escurrido', default_portion: 80, nutriments: { 'energy-kcal_100g': 198, proteins_100g: 29, carbohydrates_100g: 0, fat_100g: 8 } },
  { product_name: 'Merluza', default_portion: 180, nutriments: { 'energy-kcal_100g': 82, proteins_100g: 18, carbohydrates_100g: 0, fat_100g: 1 } },
  { product_name: 'Bacalao', default_portion: 180, nutriments: { 'energy-kcal_100g': 82, proteins_100g: 18, carbohydrates_100g: 0, fat_100g: 0.7 } },
  { product_name: 'Gambas', default_portion: 150, nutriments: { 'energy-kcal_100g': 99, proteins_100g: 24, carbohydrates_100g: 0.2, fat_100g: 0.3 } },
  // SUSHI
  { product_name: 'Sushi variado', default_portion: 240, nutriments: { 'energy-kcal_100g': 150, proteins_100g: 6, carbohydrates_100g: 25, fat_100g: 2.5 } },
  { product_name: 'Nigiri salmón', default_portion: 80, nutriments: { 'energy-kcal_100g': 160, proteins_100g: 8, carbohydrates_100g: 23, fat_100g: 3 } },
  { product_name: 'Maki salmón', default_portion: 120, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 7, carbohydrates_100g: 27, fat_100g: 3 } },
  { product_name: 'California roll', default_portion: 220, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 6, carbohydrates_100g: 28, fat_100g: 6 } },
  // TUBÉRCULOS
  { product_name: 'Patata cruda', default_portion: 200, nutriments: { 'energy-kcal_100g': 77, proteins_100g: 2, carbohydrates_100g: 17, fat_100g: 0.1 } },
  { product_name: 'Patatas air fryer con poco aceite', default_portion: 250, nutriments: { 'energy-kcal_100g': 120, proteins_100g: 2.5, carbohydrates_100g: 22, fat_100g: 3 } },
  { product_name: 'Patatas fritas comerciales', default_portion: 150, nutriments: { 'energy-kcal_100g': 312, proteins_100g: 3.4, carbohydrates_100g: 41, fat_100g: 15 } },
  { product_name: 'Batata cruda', default_portion: 250, nutriments: { 'energy-kcal_100g': 86, proteins_100g: 1.6, carbohydrates_100g: 20, fat_100g: 0.1 } },
  { product_name: 'Batata air fryer', default_portion: 250, nutriments: { 'energy-kcal_100g': 115, proteins_100g: 2, carbohydrates_100g: 24, fat_100g: 2 } },
  // VERDURAS
  { product_name: 'Maíz dulce', default_portion: 60, nutriments: { 'energy-kcal_100g': 86, proteins_100g: 3.2, carbohydrates_100g: 19, fat_100g: 1.2 } },
  { product_name: 'Tomate', default_portion: 120, nutriments: { 'energy-kcal_100g': 18, proteins_100g: 0.9, carbohydrates_100g: 3.9, fat_100g: 0.2 } },
  { product_name: 'Pepino', default_portion: 100, nutriments: { 'energy-kcal_100g': 15, proteins_100g: 0.7, carbohydrates_100g: 3.6, fat_100g: 0.1 } },
  { product_name: 'Cebolla', default_portion: 80, nutriments: { 'energy-kcal_100g': 40, proteins_100g: 1.1, carbohydrates_100g: 9.3, fat_100g: 0.1 } },
  { product_name: 'Pimiento rojo', default_portion: 100, nutriments: { 'energy-kcal_100g': 31, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 0.3 } },
  { product_name: 'Pimiento verde', default_portion: 100, nutriments: { 'energy-kcal_100g': 20, proteins_100g: 0.9, carbohydrates_100g: 4.6, fat_100g: 0.2 } },
  { product_name: 'Lechuga', default_portion: 80, nutriments: { 'energy-kcal_100g': 15, proteins_100g: 1.4, carbohydrates_100g: 2.9, fat_100g: 0.2 } },
  { product_name: 'Espinacas', default_portion: 100, nutriments: { 'energy-kcal_100g': 23, proteins_100g: 2.9, carbohydrates_100g: 3.6, fat_100g: 0.4 } },
  { product_name: 'Brócoli', default_portion: 150, nutriments: { 'energy-kcal_100g': 34, proteins_100g: 2.8, carbohydrates_100g: 6.6, fat_100g: 0.4 } },
  { product_name: 'Calabacín', default_portion: 150, nutriments: { 'energy-kcal_100g': 17, proteins_100g: 1.2, carbohydrates_100g: 3.1, fat_100g: 0.3 } },
  { product_name: 'Berenjena', default_portion: 150, nutriments: { 'energy-kcal_100g': 25, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 0.2 } },
  { product_name: 'Zanahoria', default_portion: 100, nutriments: { 'energy-kcal_100g': 41, proteins_100g: 0.9, carbohydrates_100g: 10, fat_100g: 0.2 } },
  { product_name: 'Champiñones', default_portion: 100, nutriments: { 'energy-kcal_100g': 22, proteins_100g: 3.1, carbohydrates_100g: 3.3, fat_100g: 0.3 } },
  { product_name: 'Guisantes', default_portion: 100, nutriments: { 'energy-kcal_100g': 81, proteins_100g: 5.4, carbohydrates_100g: 14, fat_100g: 0.4 } },
  { product_name: 'Judías verdes', default_portion: 150, nutriments: { 'energy-kcal_100g': 31, proteins_100g: 1.8, carbohydrates_100g: 7, fat_100g: 0.1 } },
  { product_name: 'Coliflor', default_portion: 150, nutriments: { 'energy-kcal_100g': 25, proteins_100g: 1.9, carbohydrates_100g: 5, fat_100g: 0.3 } },
  { product_name: 'Ajo', default_portion: 5, nutriments: { 'energy-kcal_100g': 149, proteins_100g: 6.4, carbohydrates_100g: 33, fat_100g: 0.5 } },
  { product_name: 'Pico de gallo', default_portion: 80, nutriments: { 'energy-kcal_100g': 30, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 0.2 } },
  { product_name: 'Ensalada variada', default_portion: 150, nutriments: { 'energy-kcal_100g': 25, proteins_100g: 1.5, carbohydrates_100g: 4, fat_100g: 0.3 } },
  { product_name: 'Pepinillos', default_portion: 40, nutriments: { 'energy-kcal_100g': 12, proteins_100g: 0.5, carbohydrates_100g: 2.4, fat_100g: 0.2 } },
  { product_name: 'Aceitunas verdes', default_portion: 30, nutriments: { 'energy-kcal_100g': 145, proteins_100g: 1, carbohydrates_100g: 3.8, fat_100g: 15 } },
  // FRUTAS
  { product_name: 'Plátano', default_portion: 120, nutriments: { 'energy-kcal_100g': 89, proteins_100g: 1.1, carbohydrates_100g: 23, fat_100g: 0.3 } },
  { product_name: 'Manzana', default_portion: 180, nutriments: { 'energy-kcal_100g': 52, proteins_100g: 0.3, carbohydrates_100g: 14, fat_100g: 0.2 } },
  { product_name: 'Pera', default_portion: 170, nutriments: { 'energy-kcal_100g': 57, proteins_100g: 0.4, carbohydrates_100g: 15, fat_100g: 0.1 } },
  { product_name: 'Naranja', default_portion: 180, nutriments: { 'energy-kcal_100g': 47, proteins_100g: 0.9, carbohydrates_100g: 12, fat_100g: 0.1 } },
  { product_name: 'Mandarina', default_portion: 100, nutriments: { 'energy-kcal_100g': 53, proteins_100g: 0.8, carbohydrates_100g: 13, fat_100g: 0.3 } },
  { product_name: 'Kiwi', default_portion: 100, nutriments: { 'energy-kcal_100g': 61, proteins_100g: 1.1, carbohydrates_100g: 15, fat_100g: 0.5 } },
  { product_name: 'Fresas', default_portion: 150, nutriments: { 'energy-kcal_100g': 32, proteins_100g: 0.7, carbohydrates_100g: 7.7, fat_100g: 0.3 } },
  { product_name: 'Arándanos', default_portion: 100, nutriments: { 'energy-kcal_100g': 57, proteins_100g: 0.7, carbohydrates_100g: 14, fat_100g: 0.3 } },
  { product_name: 'Uvas', default_portion: 150, nutriments: { 'energy-kcal_100g': 69, proteins_100g: 0.7, carbohydrates_100g: 18, fat_100g: 0.2 } },
  { product_name: 'Melón', default_portion: 200, nutriments: { 'energy-kcal_100g': 34, proteins_100g: 0.8, carbohydrates_100g: 8, fat_100g: 0.2 } },
  { product_name: 'Sandía', default_portion: 250, nutriments: { 'energy-kcal_100g': 30, proteins_100g: 0.6, carbohydrates_100g: 8, fat_100g: 0.2 } },
  { product_name: 'Mango', default_portion: 150, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 0.8, carbohydrates_100g: 15, fat_100g: 0.4 } },
  { product_name: 'Piña', default_portion: 150, nutriments: { 'energy-kcal_100g': 50, proteins_100g: 0.5, carbohydrates_100g: 13, fat_100g: 0.1 } },
  { product_name: 'Melocotón', default_portion: 150, nutriments: { 'energy-kcal_100g': 39, proteins_100g: 0.9, carbohydrates_100g: 10, fat_100g: 0.3 } },
  { product_name: 'Ciruela', default_portion: 100, nutriments: { 'energy-kcal_100g': 46, proteins_100g: 0.7, carbohydrates_100g: 11, fat_100g: 0.3 } },
  { product_name: 'Dátiles', default_portion: 30, nutriments: { 'energy-kcal_100g': 282, proteins_100g: 2.5, carbohydrates_100g: 75, fat_100g: 0.4 } },
  // LEGUMBRES Y FRUTOS SECOS
  { product_name: 'Lentejas cocidas', default_portion: 250, nutriments: { 'energy-kcal_100g': 116, proteins_100g: 9, carbohydrates_100g: 20, fat_100g: 0.4 } },
  { product_name: 'Garbanzos cocidos', default_portion: 250, nutriments: { 'energy-kcal_100g': 164, proteins_100g: 8.9, carbohydrates_100g: 27, fat_100g: 2.6 } },
  { product_name: 'Alubias cocidas', default_portion: 250, nutriments: { 'energy-kcal_100g': 127, proteins_100g: 8.7, carbohydrates_100g: 23, fat_100g: 0.5 } },
  { product_name: 'Hummus', default_portion: 60, nutriments: { 'energy-kcal_100g': 166, proteins_100g: 8, carbohydrates_100g: 14, fat_100g: 10 } },
  { product_name: 'Edamame', default_portion: 150, nutriments: { 'energy-kcal_100g': 121, proteins_100g: 11, carbohydrates_100g: 9, fat_100g: 5 } },
  { product_name: 'Frutos secos mix', default_portion: 30, nutriments: { 'energy-kcal_100g': 607, proteins_100g: 20, carbohydrates_100g: 21, fat_100g: 54 } },
  { product_name: 'Almendras', default_portion: 30, nutriments: { 'energy-kcal_100g': 579, proteins_100g: 21, carbohydrates_100g: 22, fat_100g: 50 } },
  { product_name: 'Nueces', default_portion: 30, nutriments: { 'energy-kcal_100g': 654, proteins_100g: 15, carbohydrates_100g: 14, fat_100g: 65 } },
  { product_name: 'Anacardos', default_portion: 30, nutriments: { 'energy-kcal_100g': 553, proteins_100g: 18, carbohydrates_100g: 30, fat_100g: 44 } },
  { product_name: 'Pistachos', default_portion: 30, nutriments: { 'energy-kcal_100g': 560, proteins_100g: 20, carbohydrates_100g: 28, fat_100g: 45 } },
  { product_name: 'Crema de cacahuete', default_portion: 20, nutriments: { 'energy-kcal_100g': 588, proteins_100g: 25, carbohydrates_100g: 20, fat_100g: 50 } },
  // PLATOS COMBINADOS ALBERTO
  { product_name: 'Ensalada de arroz Alberto', default_portion: 550, nutriments: { 'energy-kcal_100g': 125, proteins_100g: 6.5, carbohydrates_100g: 19, fat_100g: 2.5 } },
  { product_name: 'Ensalada de pasta Alberto', default_portion: 550, nutriments: { 'energy-kcal_100g': 145, proteins_100g: 7, carbohydrates_100g: 22, fat_100g: 3 } },
  { product_name: 'Fajitas de ternera Alberto', default_portion: 450, nutriments: { 'energy-kcal_100g': 210, proteins_100g: 14, carbohydrates_100g: 16, fat_100g: 10 } },
  { product_name: 'Tostadas centeno tomate aceite', default_portion: 140, nutriments: { 'energy-kcal_100g': 230, proteins_100g: 6, carbohydrates_100g: 32, fat_100g: 9 } },
  { product_name: 'Tostadas centeno aguacate huevo', default_portion: 220, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 9, carbohydrates_100g: 24, fat_100g: 10 } },
  { product_name: 'Hamburguesa completa ternera', default_portion: 300, nutriments: { 'energy-kcal_100g': 260, proteins_100g: 13, carbohydrates_100g: 22, fat_100g: 14 } },
  { product_name: 'Hamburguesa pollo air fryer completa', default_portion: 300, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 15, carbohydrates_100g: 22, fat_100g: 8 } },
  { product_name: 'Bowl arroz pollo aguacate', default_portion: 550, nutriments: { 'energy-kcal_100g': 165, proteins_100g: 12, carbohydrates_100g: 18, fat_100g: 5 } },
  { product_name: 'Bowl arroz salmón aguacate', default_portion: 500, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 10, carbohydrates_100g: 17, fat_100g: 9 } },
  { product_name: 'Pollo al curry con arroz', default_portion: 550, nutriments: { 'energy-kcal_100g': 160, proteins_100g: 11, carbohydrates_100g: 20, fat_100g: 4 } },
  { product_name: 'Arroz coreano con pollo', default_portion: 550, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 12, carbohydrates_100g: 20, fat_100g: 5 } },
  { product_name: 'Puré de verduras', default_portion: 350, nutriments: { 'energy-kcal_100g': 55, proteins_100g: 1.5, carbohydrates_100g: 9, fat_100g: 1.5 } },
  { product_name: 'Kebab durum pollo', default_portion: 450, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 12, carbohydrates_100g: 24, fat_100g: 9 } },
  { product_name: 'Burrito pollo', default_portion: 400, nutriments: { 'energy-kcal_100g': 200, proteins_100g: 12, carbohydrates_100g: 24, fat_100g: 7 } },
  { product_name: 'Pasta boloñesa', default_portion: 450, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 9, carbohydrates_100g: 21, fat_100g: 6 } },
  { product_name: 'Macarrones con tomate y atún', default_portion: 500, nutriments: { 'energy-kcal_100g': 155, proteins_100g: 9, carbohydrates_100g: 23, fat_100g: 3 } },
  { product_name: 'Tortilla francesa', default_portion: 120, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 13, carbohydrates_100g: 1, fat_100g: 14 } },
  { product_name: 'Tortilla de patata', default_portion: 180, nutriments: { 'energy-kcal_100g': 210, proteins_100g: 6, carbohydrates_100g: 17, fat_100g: 13 } },
  { product_name: 'Croquetas', default_portion: 120, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 8, carbohydrates_100g: 24, fat_100g: 14 } },
  { product_name: 'Empanadillas', default_portion: 120, nutriments: { 'energy-kcal_100g': 280, proteins_100g: 9, carbohydrates_100g: 30, fat_100g: 14 } },
  { product_name: 'Pizza casera pollo cebolla queso', default_portion: 450, nutriments: { 'energy-kcal_100g': 210, proteins_100g: 14, carbohydrates_100g: 20, fat_100g: 8 } },
  { product_name: 'Pizza comercial media', default_portion: 350, nutriments: { 'energy-kcal_100g': 260, proteins_100g: 11, carbohydrates_100g: 32, fat_100g: 10 } },
  // DULCES Y SNACKS
  { product_name: 'Helado', default_portion: 100, nutriments: { 'energy-kcal_100g': 210, proteins_100g: 3.5, carbohydrates_100g: 24, fat_100g: 11 } },
  { product_name: 'Chocolate negro 85%', default_portion: 20, nutriments: { 'energy-kcal_100g': 600, proteins_100g: 10, carbohydrates_100g: 19, fat_100g: 52 } },
  { product_name: 'Galletas tipo María', default_portion: 28, nutriments: { 'energy-kcal_100g': 430, proteins_100g: 7, carbohydrates_100g: 74, fat_100g: 11 } },
  { product_name: 'Barrita de cereales', default_portion: 25, nutriments: { 'energy-kcal_100g': 400, proteins_100g: 6, carbohydrates_100g: 65, fat_100g: 12 } },
  { product_name: 'Tortitas de arroz', default_portion: 18, nutriments: { 'energy-kcal_100g': 380, proteins_100g: 8, carbohydrates_100g: 82, fat_100g: 3 } },
  { product_name: 'Nachos', default_portion: 60, nutriments: { 'energy-kcal_100g': 490, proteins_100g: 7, carbohydrates_100g: 57, fat_100g: 24 } },
  { product_name: 'Doritos', default_portion: 44, nutriments: { 'energy-kcal_100g': 510, proteins_100g: 6, carbohydrates_100g: 61, fat_100g: 25 } },
  { product_name: 'Palomitas', default_portion: 40, nutriments: { 'energy-kcal_100g': 387, proteins_100g: 12, carbohydrates_100g: 78, fat_100g: 4 } },
  // FRUTAS EXÓTICAS
  { product_name: 'Papaya', default_portion: 200, nutriments: { 'energy-kcal_100g': 43, proteins_100g: 0.5, carbohydrates_100g: 11, fat_100g: 0.3 } },
  { product_name: 'Pomelo', default_portion: 250, nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0.8, carbohydrates_100g: 10, fat_100g: 0.1 } },
  { product_name: 'Lima', default_portion: 80, nutriments: { 'energy-kcal_100g': 30, proteins_100g: 0.7, carbohydrates_100g: 11, fat_100g: 0.2 } },
  { product_name: 'Limón', default_portion: 80, nutriments: { 'energy-kcal_100g': 29, proteins_100g: 1.1, carbohydrates_100g: 9, fat_100g: 0.3 } },
  { product_name: 'Maracuyá', default_portion: 100, nutriments: { 'energy-kcal_100g': 97, proteins_100g: 2.2, carbohydrates_100g: 23, fat_100g: 0.7 } },
  { product_name: 'Guayaba', default_portion: 150, nutriments: { 'energy-kcal_100g': 68, proteins_100g: 2.6, carbohydrates_100g: 14, fat_100g: 1 } },
  { product_name: 'Lichi', default_portion: 100, nutriments: { 'energy-kcal_100g': 66, proteins_100g: 0.8, carbohydrates_100g: 17, fat_100g: 0.4 } },
  { product_name: 'Chirimoya', default_portion: 200, nutriments: { 'energy-kcal_100g': 75, proteins_100g: 1.6, carbohydrates_100g: 18, fat_100g: 0.7 } },
  { product_name: 'Mango deshidratado', default_portion: 40, nutriments: { 'energy-kcal_100g': 320, proteins_100g: 2.5, carbohydrates_100g: 78, fat_100g: 1 } },
  { product_name: 'Manzana asada', default_portion: 200, nutriments: { 'energy-kcal_100g': 85, proteins_100g: 0.3, carbohydrates_100g: 22, fat_100g: 0.2 } },
  { product_name: 'Plátano maduro asado', default_portion: 180, nutriments: { 'energy-kcal_100g': 122, proteins_100g: 1.3, carbohydrates_100g: 32, fat_100g: 0.3 } },
  { product_name: 'Melón piel de sapo', default_portion: 300, nutriments: { 'energy-kcal_100g': 34, proteins_100g: 0.8, carbohydrates_100g: 8, fat_100g: 0.2 } },
  // CARNES PREPARADAS
  { product_name: 'Albóndigas de pollo', default_portion: 250, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 21, carbohydrates_100g: 6, fat_100g: 8 } },
  { product_name: 'Albóndigas de pavo', default_portion: 250, nutriments: { 'energy-kcal_100g': 165, proteins_100g: 22, carbohydrates_100g: 5, fat_100g: 6 } },
  { product_name: 'Albóndigas mixtas', default_portion: 250, nutriments: { 'energy-kcal_100g': 260, proteins_100g: 16, carbohydrates_100g: 9, fat_100g: 18 } },
  { product_name: 'Albóndigas en salsa', default_portion: 300, nutriments: { 'energy-kcal_100g': 195, proteins_100g: 15, carbohydrates_100g: 11, fat_100g: 10 } },
  { product_name: 'Filetes rusos', default_portion: 220, nutriments: { 'energy-kcal_100g': 230, proteins_100g: 18, carbohydrates_100g: 7, fat_100g: 14 } },
  { product_name: 'Pollo crispy', default_portion: 220, nutriments: { 'energy-kcal_100g': 250, proteins_100g: 20, carbohydrates_100g: 18, fat_100g: 12 } },
  { product_name: 'Tiras pollo especiadas', default_portion: 220, nutriments: { 'energy-kcal_100g': 185, proteins_100g: 24, carbohydrates_100g: 5, fat_100g: 7 } },
  // SOPAS Y PURÉS
  { product_name: 'Puré de calabacín', default_portion: 350, nutriments: { 'energy-kcal_100g': 45, proteins_100g: 1.4, carbohydrates_100g: 7, fat_100g: 1.2 } },
  { product_name: 'Puré de calabaza', default_portion: 350, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 1.6, carbohydrates_100g: 10, fat_100g: 1.5 } },
  { product_name: 'Puré de zanahoria', default_portion: 350, nutriments: { 'energy-kcal_100g': 65, proteins_100g: 1.2, carbohydrates_100g: 12, fat_100g: 1.5 } },
  { product_name: 'Crema de verduras', default_portion: 350, nutriments: { 'energy-kcal_100g': 75, proteins_100g: 2, carbohydrates_100g: 10, fat_100g: 3 } },
  { product_name: 'Crema de champiñones', default_portion: 350, nutriments: { 'energy-kcal_100g': 95, proteins_100g: 3.5, carbohydrates_100g: 8, fat_100g: 5 } },
  { product_name: 'Sopa de pollo', default_portion: 400, nutriments: { 'energy-kcal_100g': 45, proteins_100g: 4, carbohydrates_100g: 4, fat_100g: 1.5 } },
  { product_name: 'Sopa de verduras', default_portion: 400, nutriments: { 'energy-kcal_100g': 35, proteins_100g: 1.5, carbohydrates_100g: 5, fat_100g: 1 } },
  { product_name: 'Sopa de fideos', default_portion: 400, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 2, carbohydrates_100g: 10, fat_100g: 1.5 } },
  { product_name: 'Caldo de pollo', default_portion: 400, nutriments: { 'energy-kcal_100g': 12, proteins_100g: 1.5, carbohydrates_100g: 0.5, fat_100g: 0.3 } },
  { product_name: 'Ramen instantáneo', default_portion: 500, nutriments: { 'energy-kcal_100g': 450, proteins_100g: 10, carbohydrates_100g: 55, fat_100g: 20 } },
  // PLATOS ADICIONALES
  { product_name: 'Arroz tres delicias', default_portion: 500, nutriments: { 'energy-kcal_100g': 165, proteins_100g: 6, carbohydrates_100g: 24, fat_100g: 5 } },
  { product_name: 'Paella mixta', default_portion: 500, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 9, carbohydrates_100g: 22, fat_100g: 6 } },
  { product_name: 'Lasaña boloñesa', default_portion: 400, nutriments: { 'energy-kcal_100g': 175, proteins_100g: 10, carbohydrates_100g: 15, fat_100g: 8 } },
  { product_name: 'Canelones carne', default_portion: 400, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 11, carbohydrates_100g: 17, fat_100g: 9 } },
  { product_name: 'Mac and cheese', default_portion: 350, nutriments: { 'energy-kcal_100g': 240, proteins_100g: 9, carbohydrates_100g: 28, fat_100g: 10 } },
  { product_name: 'Pasta carbonara', default_portion: 450, nutriments: { 'energy-kcal_100g': 210, proteins_100g: 10, carbohydrates_100g: 22, fat_100g: 9 } },
  { product_name: 'Pasta pesto', default_portion: 450, nutriments: { 'energy-kcal_100g': 230, proteins_100g: 7, carbohydrates_100g: 25, fat_100g: 11 } },
  { product_name: 'Arroz con curry', default_portion: 450, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 5, carbohydrates_100g: 28, fat_100g: 4 } },
  { product_name: 'Huevos rotos con jamón', default_portion: 450, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 10, carbohydrates_100g: 17, fat_100g: 12 } },
  { product_name: 'Croquetas de pollo', default_portion: 150, nutriments: { 'energy-kcal_100g': 230, proteins_100g: 10, carbohydrates_100g: 22, fat_100g: 12 } },
  { product_name: 'Empanada de atún', default_portion: 200, nutriments: { 'energy-kcal_100g': 280, proteins_100g: 11, carbohydrates_100g: 28, fat_100g: 14 } },
  { product_name: 'Wrap pollo queso', default_portion: 300, nutriments: { 'energy-kcal_100g': 210, proteins_100g: 15, carbohydrates_100g: 20, fat_100g: 8 } },
  // DULCES Y SNACKS EXTRA
  { product_name: 'Bizcocho casero', default_portion: 80, nutriments: { 'energy-kcal_100g': 320, proteins_100g: 6, carbohydrates_100g: 48, fat_100g: 12 } },
  { product_name: 'Donut glaseado', default_portion: 60, nutriments: { 'energy-kcal_100g': 450, proteins_100g: 5, carbohydrates_100g: 50, fat_100g: 24 } },
  { product_name: 'Brownie', default_portion: 80, nutriments: { 'energy-kcal_100g': 410, proteins_100g: 5, carbohydrates_100g: 50, fat_100g: 20 } },
  { product_name: 'Magdalenas', default_portion: 60, nutriments: { 'energy-kcal_100g': 380, proteins_100g: 6, carbohydrates_100g: 52, fat_100g: 16 } },
  { product_name: 'Barrita proteica', default_portion: 60, nutriments: { 'energy-kcal_100g': 380, proteins_100g: 30, carbohydrates_100g: 35, fat_100g: 12 } },
  { product_name: 'Chocolate con leche', default_portion: 30, nutriments: { 'energy-kcal_100g': 535, proteins_100g: 7, carbohydrates_100g: 57, fat_100g: 30 } },
  { product_name: 'Gominolas', default_portion: 50, nutriments: { 'energy-kcal_100g': 340, proteins_100g: 5, carbohydrates_100g: 77, fat_100g: 0 } },
  // NOODLES Y FIDEOS
  { product_name: 'Fideos noodles de trigo secos', default_portion: 90, nutriments: { 'energy-kcal_100g': 350, proteins_100g: 11, carbohydrates_100g: 68, fat_100g: 3 } },
  { product_name: 'Fideos noodles de trigo cocidos', default_portion: 250, nutriments: { 'energy-kcal_100g': 138, proteins_100g: 5, carbohydrates_100g: 27, fat_100g: 1.5 } },
  { product_name: 'Fideos ramen secos', default_portion: 90, nutriments: { 'energy-kcal_100g': 450, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 18 } },
  { product_name: 'Ramen instantáneo preparado', default_portion: 500, nutriments: { 'energy-kcal_100g': 85, proteins_100g: 2.5, carbohydrates_100g: 11, fat_100g: 3.5 } },
  { product_name: 'Fideos de arroz secos', default_portion: 90, nutriments: { 'energy-kcal_100g': 360, proteins_100g: 6, carbohydrates_100g: 80, fat_100g: 1 } },
  { product_name: 'Fideos de arroz cocidos', default_portion: 250, nutriments: { 'energy-kcal_100g': 110, proteins_100g: 2, carbohydrates_100g: 24, fat_100g: 0.5 } },
  { product_name: 'Fideos udon cocidos', default_portion: 250, nutriments: { 'energy-kcal_100g': 127, proteins_100g: 3, carbohydrates_100g: 26, fat_100g: 0.4 } },
  { product_name: 'Fideos soba cocidos', default_portion: 250, nutriments: { 'energy-kcal_100g': 99, proteins_100g: 5, carbohydrates_100g: 21, fat_100g: 0.1 } },
  { product_name: 'Noodles yakisoba preparados', default_portion: 350, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 6, carbohydrates_100g: 28, fat_100g: 5 } },
  { product_name: 'Noodles pollo verduras', default_portion: 350, nutriments: { 'energy-kcal_100g': 160, proteins_100g: 8, carbohydrates_100g: 22, fat_100g: 4 } },
  { product_name: 'Noodles ternera', default_portion: 350, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 10, carbohydrates_100g: 23, fat_100g: 6 } },
  { product_name: 'Noodles picantes coreanos', default_portion: 140, nutriments: { 'energy-kcal_100g': 420, proteins_100g: 8, carbohydrates_100g: 60, fat_100g: 16 } },
  { product_name: 'Cup noodles', default_portion: 75, nutriments: { 'energy-kcal_100g': 430, proteins_100g: 9, carbohydrates_100g: 58, fat_100g: 18 } },
  // SALSAS
  { product_name: 'Salsa soja baja en sal', default_portion: 15, nutriments: { 'energy-kcal_100g': 45, proteins_100g: 7, carbohydrates_100g: 3.5, fat_100g: 0.3 } },
  { product_name: 'Salsa teriyaki', default_portion: 20, nutriments: { 'energy-kcal_100g': 150, proteins_100g: 4, carbohydrates_100g: 30, fat_100g: 1 } },
  { product_name: 'Salsa agridulce', default_portion: 20, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 1, carbohydrates_100g: 45, fat_100g: 0.2 } },
  { product_name: 'Salsa burger', default_portion: 20, nutriments: { 'energy-kcal_100g': 450, proteins_100g: 1.5, carbohydrates_100g: 10, fat_100g: 44 } },
  { product_name: 'Salsa burger 0%', default_portion: 20, nutriments: { 'energy-kcal_100g': 110, proteins_100g: 2, carbohydrates_100g: 12, fat_100g: 4 } },
  { product_name: 'Ketchup 0 azúcar', default_portion: 20, nutriments: { 'energy-kcal_100g': 25, proteins_100g: 1.5, carbohydrates_100g: 5, fat_100g: 0.2 } },
  { product_name: 'Mostaza 0 azúcar', default_portion: 15, nutriments: { 'energy-kcal_100g': 15, proteins_100g: 3, carbohydrates_100g: 1, fat_100g: 0.5 } },
  { product_name: 'Mayonesa ligera', default_portion: 15, nutriments: { 'energy-kcal_100g': 260, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 25 } },
  { product_name: 'Alioli', default_portion: 15, nutriments: { 'energy-kcal_100g': 720, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 78 } },
  { product_name: 'Salsa barbacoa', default_portion: 20, nutriments: { 'energy-kcal_100g': 170, proteins_100g: 1, carbohydrates_100g: 40, fat_100g: 0.5 } },
  { product_name: 'Salsa barbacoa 0 azúcar', default_portion: 20, nutriments: { 'energy-kcal_100g': 35, proteins_100g: 1, carbohydrates_100g: 7, fat_100g: 0.2 } },
  { product_name: 'Sriracha', default_portion: 10, nutriments: { 'energy-kcal_100g': 93, proteins_100g: 1.3, carbohydrates_100g: 16, fat_100g: 1.2 } },
  { product_name: 'Tabasco', default_portion: 5, nutriments: { 'energy-kcal_100g': 12, proteins_100g: 0.5, carbohydrates_100g: 2, fat_100g: 0.1 } },
  { product_name: 'Salsa curry', default_portion: 20, nutriments: { 'energy-kcal_100g': 130, proteins_100g: 2, carbohydrates_100g: 18, fat_100g: 5 } },
  { product_name: 'Salsa César', default_portion: 20, nutriments: { 'energy-kcal_100g': 520, proteins_100g: 4, carbohydrates_100g: 6, fat_100g: 53 } },
  { product_name: 'Salsa yogur ligera', default_portion: 30, nutriments: { 'energy-kcal_100g': 75, proteins_100g: 5, carbohydrates_100g: 4, fat_100g: 4 } },
  { product_name: 'Pesto verde', default_portion: 20, nutriments: { 'energy-kcal_100g': 460, proteins_100g: 5, carbohydrates_100g: 6, fat_100g: 45 } },
  { product_name: 'Pesto rojo', default_portion: 20, nutriments: { 'energy-kcal_100g': 420, proteins_100g: 5, carbohydrates_100g: 8, fat_100g: 40 } },
  { product_name: 'Salsa carbonara', default_portion: 60, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 5, carbohydrates_100g: 7, fat_100g: 19 } },
  { product_name: 'Salsa boloñesa', default_portion: 100, nutriments: { 'energy-kcal_100g': 90, proteins_100g: 5, carbohydrates_100g: 7, fat_100g: 4 } },
  { product_name: 'Salsa de queso', default_portion: 40, nutriments: { 'energy-kcal_100g': 280, proteins_100g: 8, carbohydrates_100g: 10, fat_100g: 23 } },
  { product_name: 'Salsa kebab', default_portion: 30, nutriments: { 'energy-kcal_100g': 320, proteins_100g: 3, carbohydrates_100g: 8, fat_100g: 30 } },
  // EXTRAS ASIÁTICOS
  { product_name: 'Tofu firme', default_portion: 180, nutriments: { 'energy-kcal_100g': 144, proteins_100g: 17, carbohydrates_100g: 3, fat_100g: 8 } },
  { product_name: 'Tofu ahumado', default_portion: 180, nutriments: { 'energy-kcal_100g': 190, proteins_100g: 20, carbohydrates_100g: 2, fat_100g: 12 } },
  { product_name: 'Seitán', default_portion: 180, nutriments: { 'energy-kcal_100g': 120, proteins_100g: 24, carbohydrates_100g: 4, fat_100g: 1.5 } },
  { product_name: 'Kimchi', default_portion: 100, nutriments: { 'energy-kcal_100g': 25, proteins_100g: 2, carbohydrates_100g: 4, fat_100g: 0.5 } },
  { product_name: 'Brotes de soja', default_portion: 100, nutriments: { 'energy-kcal_100g': 30, proteins_100g: 3, carbohydrates_100g: 5, fat_100g: 0.2 } },
  { product_name: 'Cebolla crujiente', default_portion: 20, nutriments: { 'energy-kcal_100g': 550, proteins_100g: 6, carbohydrates_100g: 42, fat_100g: 40 } },
  { product_name: 'Cacahuetes tostados', default_portion: 30, nutriments: { 'energy-kcal_100g': 585, proteins_100g: 25, carbohydrates_100g: 16, fat_100g: 49 } },
  { product_name: 'Alga nori', default_portion: 5, nutriments: { 'energy-kcal_100g': 280, proteins_100g: 30, carbohydrates_100g: 35, fat_100g: 5 } },
  { product_name: 'Gyozas de pollo', default_portion: 200, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 10, carbohydrates_100g: 26, fat_100g: 8 } },
  { product_name: 'Gyozas de verduras', default_portion: 200, nutriments: { 'energy-kcal_100g': 180, proteins_100g: 6, carbohydrates_100g: 30, fat_100g: 5 } },
  { product_name: 'Rollitos primavera', default_portion: 150, nutriments: { 'energy-kcal_100g': 240, proteins_100g: 6, carbohydrates_100g: 28, fat_100g: 12 } },
  { product_name: 'Tempura de verduras', default_portion: 180, nutriments: { 'energy-kcal_100g': 220, proteins_100g: 5, carbohydrates_100g: 28, fat_100g: 10 } },
]

const LIQUID_FOOD_NAMES = new Set(
  LOCAL_FOODS.filter((f) => f.is_liquid).map((f) => f.product_name.toLowerCase())
)

// Strip diacritics so "proteina" matches "proteína", "cafe" matches "café", etc.
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// All query words must appear somewhere in the product name (any order, any position)
function matchesQuery(productName: string, query: string): boolean {
  const normName = normalize(productName)
  const words = normalize(query).trim().split(/\s+/).filter(Boolean)
  return words.every((w) => normName.includes(w))
}

// Higher score = more relevant: name/word starts with query > substring match
function scoreMatch(productName: string, query: string): number {
  const normName = normalize(productName)
  const normQuery = normalize(query.trim())
  if (normName.startsWith(normQuery)) return 3
  if (normName.split(/\s+/).some((w) => w.startsWith(normQuery))) return 2
  return 1
}

// Extracts kcal per 100g handling both kcal and kJ fields
function extractKcal(n: OFFProduct['nutriments']): number {
  if (n['energy-kcal_100g']) return Math.round(n['energy-kcal_100g'])
  if (n['energy-kj_100g']) return Math.round(n['energy-kj_100g'] / 4.184)
  return 0
}

function FoodSearchPanel({ onAdd, onClose }: FoodSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [apiResults, setApiResults] = useState<OFFProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<OFFProduct | null>(null)
  const [gramos, setGramos] = useState<number>(100)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Local matches: accent-insensitive, all keywords must appear, sorted by relevance
  const localMatches = query.trim()
    ? LOCAL_FOODS
        .filter((f) => matchesQuery(f.product_name, query))
        .sort((a, b) => scoreMatch(b.product_name, query) - scoreMatch(a.product_name, query))
    : []
  const localMatchNames = new Set(localMatches.map((f) => f.product_name.toLowerCase()))

  // Deduplicate: skip API results whose name is already in local matches
  const localNames = new Set(localMatches.map((f) => f.product_name.toLowerCase()))
  const uniqueApiResults = apiResults.filter(
    (p) => !(localNames.has((p.product_name_es || p.product_name || '').toLowerCase()))
  )
  const results = [...localMatches, ...uniqueApiResults].slice(0, 8)

  function getDisplayName(p: OFFProduct) {
    return p.product_name_es || p.product_name || '—'
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    setSelected(null)
    setApiResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) return

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&lc=es&json=1&page_size=12&fields=product_name,product_name_es,nutriments&search_simple=1&action=process`
        )
        const json = await res.json()
        const products = (json.products ?? []).filter(
          (p: OFFProduct) => (p.product_name_es || p.product_name) && extractKcal(p.nutriments) > 0
        )
        setApiResults(products.slice(0, 8))
      } catch {
        setApiResults([])
      }
      setSearching(false)
    }, 600)
  }

  const unit = selected?.is_liquid ? 'ml' : 'g'
  const portionPresets = selected?.is_liquid ? [100, 200, 250, 500] : [100, 150, 200, 250]
  const sliderMax = selected?.is_liquid ? 1000 : 500
  const kcalPer100 = selected ? extractKcal(selected.nutriments) : 0
  const prot100 = selected?.nutriments?.proteins_100g ?? 0
  const carbs100 = selected?.nutriments?.carbohydrates_100g ?? 0
  const fat100 = selected?.nutriments?.fat_100g ?? 0
  const factor = gramos / 100
  const totalKcal = Math.round(kcalPer100 * factor)
  const totalProt = (prot100 * factor).toFixed(1)
  const totalCarbs = (carbs100 * factor).toFixed(1)
  const totalFat = (fat100 * factor).toFixed(1)

  function handleAdd() {
    if (!selected || gramos <= 0) return
    onAdd(getDisplayName(selected), gramos, totalKcal)
  }

  return (
    <div className="mt-3 p-4 rounded-2xl bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="label-caps">Buscar alimento</span>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
          <X size={14} />
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Ej: pollo, arroz, huevo, plátano..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results list */}
      {!selected && results.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 max-h-52 overflow-y-auto">
          {results.map((p, i) => (
            <button
              key={i}
              onClick={() => { setSelected(p); setGramos(p.default_portion ?? 100) }}
              className="text-left px-3 py-2.5 flex items-center justify-between rounded-xl bg-white"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold truncate text-gray-800">
                    {getDisplayName(p)}
                  </span>
                  {localMatchNames.has(p.product_name.toLowerCase()) && (
                    <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: '#FFF5F0', color: '#FF6B35' }}>★ mi base</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {p.nutriments.proteins_100g != null && (
                    <span className="text-[10px] font-semibold" style={{ color: '#3B82F6' }}>
                      P {p.nutriments.proteins_100g.toFixed(1)}g
                    </span>
                  )}
                  {p.nutriments.carbohydrates_100g != null && (
                    <span className="text-[10px] font-semibold" style={{ color: '#D97706' }}>
                      HC {p.nutriments.carbohydrates_100g.toFixed(1)}g
                    </span>
                  )}
                  {p.nutriments.fat_100g != null && (
                    <span className="text-[10px] font-semibold" style={{ color: '#EF4444' }}>
                      G {p.nutriments.fat_100g.toFixed(1)}g
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-black block" style={{ color: '#FF6B35' }}>
                  {Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0)}
                </span>
                <span className="text-[10px] text-gray-400">kcal/100g</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected product + portion picker */}
      {selected && (
        <div>
          {/* Selected product chip */}
          <div
            className="flex items-center justify-between px-3 py-2.5 mb-3 rounded-xl bg-white border-2"
            style={{ borderColor: '#FF6B35' }}
          >
            <span className="text-sm font-semibold truncate pr-4 text-gray-800">
              {getDisplayName(selected)}
            </span>
            <button
              onClick={() => { setSelected(null); setGramos(100) }}
              className="text-gray-300 shrink-0"
            >
              <X size={12} />
            </button>
          </div>

          {/* Quick portion presets */}
          <span className="label-caps block mb-2">Porción rápida</span>
          <div className="flex gap-1.5 mb-3">
            {portionPresets.map((p) => (
              <button
                key={p}
                onClick={() => setGramos(p)}
                className="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
                style={{
                  background: gramos === p ? '#1A1A1A' : '#FFFFFF',
                  color: gramos === p ? '#FF6B35' : '#9CA3AF',
                  border: gramos === p ? 'none' : '1.5px solid #E5E7EB',
                }}
              >
                {p}{unit}
              </button>
            ))}
          </div>

          {/* Gramos slider + input sincronizados */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="label-caps">Cantidad manual</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={gramos || ''}
                  onChange={(e) => setGramos(Math.min(sliderMax, Math.max(0, parseInt(e.target.value) || 0)))}
                  min="0"
                  max={sliderMax}
                  className="w-16 px-2 py-1 text-sm rounded-lg text-center font-black"
                  style={{ color: '#FF6B35' }}
                />
                <span className="text-xs text-gray-400 font-semibold">{unit}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-300">0</span>
              <input
                type="range"
                min="0"
                max={sliderMax}
                step="5"
                value={gramos}
                onChange={(e) => setGramos(parseInt(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#FF6B35' }}
              />
              <span className="text-[10px] text-gray-300">{sliderMax}{unit}</span>
            </div>
          </div>

          {/* Live kcal */}
          <div className="flex items-center justify-center gap-2 mb-3 py-2.5 rounded-xl" style={{ background: '#FFF5F0' }}>
            <div className="font-black text-3xl leading-none" style={{ color: '#FF6B35' }}>
              {totalKcal}
            </div>
            <div className="label-caps">kcal</div>
          </div>

          {/* Macro breakdown */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-xl" style={{ background: '#EFF6FF' }}>
              <div className="font-bold text-sm" style={{ color: '#3B82F6' }}>{totalProt}g</div>
              <div className="label-caps mt-0.5">proteína</div>
            </div>
            <div className="text-center p-2 rounded-xl" style={{ background: '#FFFBEB' }}>
              <div className="font-bold text-sm" style={{ color: '#D97706' }}>{totalCarbs}g</div>
              <div className="label-caps mt-0.5">hidratos</div>
            </div>
            <div className="text-center p-2 rounded-xl" style={{ background: '#FEF2F2' }}>
              <div className="font-bold text-sm" style={{ color: '#EF4444' }}>{totalFat}g</div>
              <div className="label-caps mt-0.5">grasas</div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={gramos <= 0}
            className="w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase disabled:opacity-40"
            style={{ background: '#FF6B35', color: '#fff' }}
          >
            Añadir al registro
          </button>
        </div>
      )}

      {query && !searching && results.length === 0 && !selected && (
        <p className="text-xs py-3 text-center text-gray-400">
          Sin resultados para &quot;{query}&quot;
        </p>
      )}
    </div>
  )
}
