'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase, IS_SUPABASE_CONFIGURED } from '@/lib/supabase'
import type { FoodEntry, MealSection } from '@/lib/types'
import { MEAL_LABELS } from '@/lib/types'
import { Plus, Trash2, Search, X, ChevronDown, ChevronUp, Flame } from 'lucide-react'

const MEAL_ORDER: MealSection[] = ['desayuno', 'almuerzo', 'comida', 'pre_entreno', 'post_entreno', 'cena']

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

  useEffect(() => {
    if (!user || !IS_SUPABASE_CONFIGURED) { setLoading(false); return }
    fetchEntries()
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

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 md:px-8 md:pt-10">

      {/* ── Header ─────────────────────────────────── */}
      <header className="mb-8">
        <span className="label-caps block mb-1">Módulo 02</span>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-black" style={{ fontSize: 'clamp(1.75rem, 7vw, 3.5rem)', color: '#ffffff', lineHeight: 1 }}>
            ALIMENTACIÓN
          </h1>
          <div className="text-right shrink-0">
            <div className="font-black" style={{ fontSize: '2rem', color: '#FF2D00', lineHeight: 1 }}>
              {totalKcal.toLocaleString()}
            </div>
            <div className="label-caps">kcal hoy</div>
          </div>
        </div>
        <div className="w-8 h-0.5 mt-3" style={{ background: '#FF2D00' }} />
      </header>

      {/* ── Total bar ──────────────────────────────── */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <Flame size={18} style={{ color: '#FF2D00' }} />
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="label-caps">Total consumido</span>
            <span className="font-bold text-sm" style={{ color: '#FF2D00' }}>{totalKcal} kcal</span>
          </div>
          <div className="h-1 w-full rounded-full" style={{ background: '#2a2a2a' }}>
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalKcal / 2500) * 100)}%`, background: '#FF2D00' }}
            />
          </div>
          <div className="label-caps mt-1">Objetivo orientativo: 2500 kcal</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#FF2D00] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {MEAL_ORDER.map((section) => {
            const sectionEntries = entries.filter((e) => e.apartado === section)
            const sectionKcal = sectionEntries.reduce((s, e) => s + e.calorias, 0)
            const isOpen = openSection === section

            return (
              <div key={section} className="card">
                {/* Section header */}
                <button
                  onClick={() => setOpenSection(isOpen ? null : section)}
                  className="w-full flex items-center justify-between px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2"
                      style={{ background: isOpen ? '#FF2D00' : '#2a2a2a' }}
                    />
                    <span className="font-bold text-sm uppercase tracking-wider" style={{ color: isOpen ? '#fff' : '#888' }}>
                      {MEAL_LABELS[section]}
                    </span>
                    {sectionEntries.length > 0 && (
                      <span className="text-xs" style={{ color: '#555' }}>{sectionEntries.length} alim.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {sectionKcal > 0 && (
                      <span className="font-bold text-sm" style={{ color: '#FF2D00' }}>
                        {sectionKcal} kcal
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={14} style={{ color: '#555' }} /> : <ChevronDown size={14} style={{ color: '#555' }} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 pb-4" style={{ borderColor: '#2a2a2a' }}>
                    {/* Food list */}
                    {sectionEntries.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2 mb-4">
                        {sectionEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-3 py-2 px-3"
                            style={{ background: '#1a1a1a' }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>
                                {entry.nombre_alimento}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: '#555' }}>
                                {entry.cantidad_gramos}g
                              </p>
                            </div>
                            <span className="font-bold text-sm shrink-0" style={{ color: '#FF2D00' }}>
                              {entry.calorias} kcal
                            </span>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="shrink-0 w-7 h-7 flex items-center justify-center"
                              style={{ color: '#444' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add food */}
                    {addingTo === section ? (
                      <FoodSearchPanel
                        onAdd={(nombre, gramos, kcal) => addEntry(section, nombre, gramos, kcal)}
                        onClose={() => setAddingTo(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingTo(section)}
                        className="mt-2 flex items-center gap-2 text-xs font-bold tracking-widest uppercase py-2 px-3"
                        style={{ color: '#FF2D00', border: '1px dashed rgba(255,45,0,0.4)' }}
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
    </div>
  )
}

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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    <div className="mt-3 p-4" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="label-caps">Buscar alimento</span>
        <button onClick={onClose}><X size={14} style={{ color: '#555' }} /></button>
      </div>

      {/* Search input */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Ej: pollo pechuga, arroz, manzana..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-none"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-[#FF2D00] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results */}
      {!selected && results.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 max-h-48 overflow-y-auto">
          {results.map((p, i) => (
            <button
              key={i}
              onClick={() => setSelected(p)}
              className="text-left px-3 py-2.5 flex items-center justify-between transition-colors"
              style={{ background: '#111', border: '1px solid #2a2a2a' }}
            >
              <span className="text-sm truncate pr-4" style={{ color: '#fff' }}>{p.product_name}</span>
              <span className="text-xs font-bold shrink-0" style={{ color: '#FF2D00' }}>
                {Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0)} kcal/100g
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected food + grams input */}
      {selected && (
        <div>
          <div className="flex items-center justify-between px-3 py-2 mb-3" style={{ background: '#111', border: '1px solid #FF2D00' }}>
            <span className="text-sm font-semibold truncate pr-4" style={{ color: '#fff' }}>{selected.product_name}</span>
            <button onClick={() => { setSelected(null); setGramos('100') }}><X size={12} style={{ color: '#555' }} /></button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="label-caps block mb-1">Cantidad (g)</label>
              <input
                type="number"
                value={gramos}
                onChange={(e) => setGramos(e.target.value)}
                min="1"
                className="w-full px-3 py-2.5 text-sm rounded-none"
              />
            </div>
            <div className="text-right">
              <div className="label-caps mb-1">Calorías</div>
              <div className="font-black text-xl" style={{ color: '#FF2D00' }}>{totalKcal}</div>
              <div className="label-caps">kcal</div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={gramsNum <= 0}
            className="w-full py-3 text-xs font-bold tracking-widest uppercase disabled:opacity-40"
            style={{ background: '#FF2D00', color: '#fff' }}
          >
            Añadir al registro
          </button>
        </div>
      )}

      {query && !searching && results.length === 0 && !selected && (
        <p className="text-xs py-3 text-center" style={{ color: '#555' }}>Sin resultados para &quot;{query}&quot;</p>
      )}
    </div>
  )
}
