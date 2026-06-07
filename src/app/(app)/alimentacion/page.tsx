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
  nutriments: { 'energy-kcal_100g'?: number }
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
    if (!user || !IS_SUPABASE_CONFIGURED) { setLoading(false); return }
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
    await supabase.from('food_entries').delete().eq('id', id)
    setEntries((e) => e.filter((x) => x.id !== id))
  }

  async function addEntry(section: MealSection, nombre: string, gramos: number, kcal: number) {
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

        <div className="flex items-center gap-3 mb-4">
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

function FoodSearchPanel({ onAdd, onClose }: FoodSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OFFProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<OFFProduct | null>(null)
  const [gramos, setGramos] = useState('100')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleQueryChange(q: string) {
    setQuery(q)
    setSelected(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=8&fields=product_name,nutriments&search_simple=1&action=process&lc=es`
        )
        const json = await res.json()
        const products = (json.products ?? []).filter(
          (p: OFFProduct) => p.product_name && p.nutriments?.['energy-kcal_100g']
        )
        setResults(products.slice(0, 8))
      } catch {
        setResults([])
      }
      setSearching(false)
    }, 500)
  }

  const kcalPer100 = selected?.nutriments?.['energy-kcal_100g'] ?? 0
  const gramsNum = parseFloat(gramos) || 0
  const totalKcal = Math.round((kcalPer100 * gramsNum) / 100)

  function handleAdd() {
    if (!selected || gramsNum <= 0) return
    onAdd(selected.product_name, gramsNum, totalKcal)
  }

  return (
    <div className="mt-3 p-4 rounded-2xl bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="label-caps">Buscar alimento</span>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
          <X size={14} />
        </button>
      </div>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Ej: pollo pechuga, arroz, manzana..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {!selected && results.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 max-h-48 overflow-y-auto">
          {results.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelected(p)}
              className="text-left px-3 py-2.5 flex items-center justify-between rounded-xl bg-white"
            >
              <span className="text-sm truncate pr-4 text-gray-700">{p.product_name}</span>
              <span className="text-xs font-bold shrink-0" style={{ color: '#FF6B35' }}>
                {Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0)} kcal/100g
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div>
          <div className="flex items-center justify-between px-3 py-2.5 mb-3 rounded-xl bg-white border-2" style={{ borderColor: '#FF6B35' }}>
            <span className="text-sm font-semibold truncate pr-4 text-gray-800">{selected.product_name}</span>
            <button onClick={() => { setSelected(null); setGramos('100') }} className="text-gray-300">
              <X size={12} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="label-caps block mb-1">Cantidad (g)</label>
              <input
                type="number"
                value={gramos}
                onChange={(e) => setGramos(e.target.value)}
                min="1"
                className="w-full px-3 py-2.5 text-sm rounded-xl"
              />
            </div>
            <div className="text-center">
              <div className="label-caps mb-1">Calorías</div>
              <div className="font-black text-2xl leading-none" style={{ color: '#FF6B35' }}>{totalKcal}</div>
              <div className="label-caps">kcal</div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={gramsNum <= 0}
            className="w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase disabled:opacity-40"
            style={{ background: '#FF6B35', color: '#fff' }}
          >
            Añadir al registro
          </button>
        </div>
      )}

      {query && !searching && results.length === 0 && !selected && (
        <p className="text-xs py-3 text-center text-gray-400">Sin resultados para &quot;{query}&quot;</p>
      )}
    </div>
  )
}
