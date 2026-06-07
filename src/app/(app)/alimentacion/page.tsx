'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { FoodEntry, MealSection } from '@/lib/types'
import { MEAL_LABELS } from '@/lib/types'
import { Plus, Trash2, Search, X, ChevronDown, ChevronUp, Flame, Footprints } from 'lucide-react'
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

const KCAL_GOAL = 2500

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
  const today = new Date().toISOString().split('T')[0]
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [openSection, setOpenSection] = useState<MealSection | null>('desayuno')
  const [addingTo, setAddingTo] = useState<MealSection | null>(null)
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; kcal: number }>>([])
  const [mounted, setMounted] = useState(false)

  // Steps — stored locally, no DB needed
  const stepsKey = `steps_${today}`
  const [steps, setSteps] = useState(0)

  useEffect(() => {
    setMounted(true)
    const saved = parseInt(localStorage.getItem(stepsKey) ?? '0') || 0
    setSteps(saved)
  }, [])

  function saveSteps(n: number) {
    const val = Math.max(0, n)
    setSteps(val)
    localStorage.setItem(stepsKey, String(val))
  }

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
  const progressPct = Math.min(100, (totalKcal / KCAL_GOAL) * 100)

  const mealChartData = MEAL_ORDER.map((section) => ({
    meal: MEAL_LABELS[section].slice(0, 5),
    kcal: entries.filter((e) => e.apartado === section).reduce((s, e) => s + e.calorias, 0),
    fill: MEAL_COLORS[section],
  }))

  const kmEstimated = (steps * 0.00075).toFixed(1)
  const kcalWalking = Math.round(steps * 0.04)

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10 max-w-2xl mx-auto">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-6">
        <span className="label-caps block mb-1">Módulo 02</span>
        <h1 className="font-black text-3xl text-gray-900">ALIMENTACIÓN</h1>
      </header>

      {/* ── Calorie progress card ──────────────────── */}
      <div className="card p-5 mb-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="label-caps block mb-1">Total consumido</span>
            <div className="flex items-end gap-2">
              <span className="font-black text-4xl leading-none text-gray-900">
                {totalKcal.toLocaleString()}
              </span>
              <span className="font-bold text-gray-400 mb-1">/ {KCAL_GOAL.toLocaleString()} kcal</span>
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
            <span className="text-xs text-gray-400">Restante: <b className="text-gray-700">{Math.max(0, KCAL_GOAL - totalKcal)}</b></span>
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
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <Footprints size={17} style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <span className="label-caps block">Pasos de hoy</span>
            <span className="text-xs text-gray-400">Introduce los pasos del día</span>
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
                              <p className="text-xs text-gray-400 mt-0.5">{entry.cantidad_gramos}g</p>
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

const PORTION_PRESETS = [100, 150, 200, 250]

// Base de datos personal de Alberto — máxima prioridad en búsquedas
const LOCAL_FOODS: OFFProduct[] = [
  { product_name: 'Pechuga de pollo cocinada', nutriments: { 'energy-kcal_100g': 165, proteins_100g: 31, carbohydrates_100g: 0, fat_100g: 3.6 } },
  { product_name: 'Ternera picada 10% grasa', nutriments: { 'energy-kcal_100g': 176, proteins_100g: 20, carbohydrates_100g: 0, fat_100g: 10 } },
  { product_name: 'Salmón crudo', nutriments: { 'energy-kcal_100g': 208, proteins_100g: 20, carbohydrates_100g: 0, fat_100g: 13 } },
  { product_name: 'Atún lata al natural escurrido', nutriments: { 'energy-kcal_100g': 116, proteins_100g: 26, carbohydrates_100g: 0, fat_100g: 1 } },
  { product_name: 'Huevo entero', nutriments: { 'energy-kcal_100g': 143, proteins_100g: 12.6, carbohydrates_100g: 0.7, fat_100g: 9.5 } },
  { product_name: 'Batido proteína HSN Evolate 2.0 Whey Isolate CFM', nutriments: { 'energy-kcal_100g': 383, proteins_100g: 90, carbohydrates_100g: 3.3, fat_100g: 1.7 } },
  { product_name: 'Arroz blanco cocido', nutriments: { 'energy-kcal_100g': 130, proteins_100g: 2.7, carbohydrates_100g: 28.2, fat_100g: 0.3 } },
  { product_name: 'Arroz integral cocido', nutriments: { 'energy-kcal_100g': 112, proteins_100g: 2.6, carbohydrates_100g: 23.5, fat_100g: 0.9 } },
  { product_name: 'Pasta cocida', nutriments: { 'energy-kcal_100g': 157, proteins_100g: 5.8, carbohydrates_100g: 30.9, fat_100g: 0.9 } },
  { product_name: 'Copos de avena', nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9, carbohydrates_100g: 66.3, fat_100g: 6.9 } },
  { product_name: 'Tortita de arroz', nutriments: { 'energy-kcal_100g': 387, proteins_100g: 8, carbohydrates_100g: 81, fat_100g: 3 } },
  { product_name: 'Tortilla de trigo / fajita', nutriments: { 'energy-kcal_100g': 310, proteins_100g: 8, carbohydrates_100g: 50, fat_100g: 8 } },
  { product_name: 'Plátano', nutriments: { 'energy-kcal_100g': 89, proteins_100g: 1.1, carbohydrates_100g: 22.8, fat_100g: 0.3 } },
  { product_name: 'Manzana', nutriments: { 'energy-kcal_100g': 52, proteins_100g: 0.3, carbohydrates_100g: 13.8, fat_100g: 0.2 } },
  { product_name: 'Yogur griego natural 0%', nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10, carbohydrates_100g: 3.6, fat_100g: 0.4 } },
  { product_name: 'Yogur griego natural entero', nutriments: { 'energy-kcal_100g': 97, proteins_100g: 9, carbohydrates_100g: 3.9, fat_100g: 5 } },
  { product_name: 'Queso mozzarella rallado', nutriments: { 'energy-kcal_100g': 280, proteins_100g: 22, carbohydrates_100g: 3, fat_100g: 20 } },
  { product_name: 'Bebida de soja sin azúcar', nutriments: { 'energy-kcal_100g': 33, proteins_100g: 3.3, carbohydrates_100g: 0.6, fat_100g: 1.8 } },
  { product_name: 'Aceite de oliva virgen extra', nutriments: { 'energy-kcal_100g': 884, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 100 } },
  { product_name: 'Aguacate', nutriments: { 'energy-kcal_100g': 160, proteins_100g: 2, carbohydrates_100g: 8.5, fat_100g: 14.7 } },
  { product_name: 'Frutos secos variados', nutriments: { 'energy-kcal_100g': 607, proteins_100g: 20, carbohydrates_100g: 21, fat_100g: 54 } },
  { product_name: 'Miel', nutriments: { 'energy-kcal_100g': 304, proteins_100g: 0.3, carbohydrates_100g: 82.4, fat_100g: 0 } },
  { product_name: 'Tomate', nutriments: { 'energy-kcal_100g': 18, proteins_100g: 0.9, carbohydrates_100g: 3.9, fat_100g: 0.2 } },
  { product_name: 'Pepino', nutriments: { 'energy-kcal_100g': 15, proteins_100g: 0.7, carbohydrates_100g: 3.6, fat_100g: 0.1 } },
  { product_name: 'Pepinillos encurtidos', nutriments: { 'energy-kcal_100g': 12, proteins_100g: 0.5, carbohydrates_100g: 2.4, fat_100g: 0.2 } },
  { product_name: 'Aceitunas verdes', nutriments: { 'energy-kcal_100g': 145, proteins_100g: 1, carbohydrates_100g: 3.8, fat_100g: 15.3 } },
  { product_name: 'Cebolla', nutriments: { 'energy-kcal_100g': 40, proteins_100g: 1.1, carbohydrates_100g: 9.3, fat_100g: 0.1 } },
  { product_name: 'Pimiento', nutriments: { 'energy-kcal_100g': 31, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 0.3 } },
  { product_name: 'Zumo de limón', nutriments: { 'energy-kcal_100g': 22, proteins_100g: 0.4, carbohydrates_100g: 6.9, fat_100g: 0.2 } },
  { product_name: 'Jengibre en polvo', nutriments: { 'energy-kcal_100g': 335, proteins_100g: 9, carbohydrates_100g: 72, fat_100g: 4.2 } },
  { product_name: 'Verduras para caldo', nutriments: { 'energy-kcal_100g': 35, proteins_100g: 1.5, carbohydrates_100g: 7, fat_100g: 0.2 } },
  { product_name: 'Salmorejo casero', nutriments: { 'energy-kcal_100g': 95, proteins_100g: 2, carbohydrates_100g: 8, fat_100g: 6 } },
  { product_name: 'Base pizza yogur + huevo', nutriments: { 'energy-kcal_100g': 130, proteins_100g: 10, carbohydrates_100g: 10, fat_100g: 5 } },
  { product_name: 'Creatina monohidrato', nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
  { product_name: 'Citrulina malato', nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
  { product_name: 'Café solo', nutriments: { 'energy-kcal_100g': 1, proteins_100g: 0.1, carbohydrates_100g: 0, fat_100g: 0 } },
]

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

  // Local matches are instant (no debounce)
  const localMatches = query.trim()
    ? LOCAL_FOODS.filter((f) =>
        f.product_name.toLowerCase().includes(query.toLowerCase())
      )
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
              onClick={() => { setSelected(p); setGramos(100) }}
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
            {PORTION_PRESETS.map((p) => (
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
                {p}g
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
                  onChange={(e) => setGramos(Math.min(500, Math.max(0, parseInt(e.target.value) || 0)))}
                  min="0"
                  max="500"
                  className="w-16 px-2 py-1 text-sm rounded-lg text-center font-black"
                  style={{ color: '#FF6B35' }}
                />
                <span className="text-xs text-gray-400 font-semibold">g</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-300">0</span>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                value={gramos}
                onChange={(e) => setGramos(parseInt(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#FF6B35' }}
              />
              <span className="text-[10px] text-gray-300">500g</span>
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
