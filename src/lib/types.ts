export type TaskWhen = 'hoy' | 'manana' | 'semana' | 'fecha' | 'sin_fecha'
export type TaskStatus = 'por_hacer' | 'en_proceso' | 'terminada'
export type MealSection = 'desayuno' | 'almuerzo' | 'comida' | 'pre_entreno' | 'post_entreno' | 'cena'
export type WorkoutType = 'boxeo_tecnica' | 'boxeo_fisico' | 'sparring' | 'pesas' | 'boxeo_pesas' | 'descanso'

export interface Task {
  id: string
  user_id: string
  nombre: string
  descripcion?: string | null
  cuando: TaskWhen
  fecha_objetivo?: string | null
  estado: TaskStatus
  fecha_creacion: string
}

export interface FoodEntry {
  id: string
  user_id: string
  fecha: string
  apartado: MealSection
  nombre_alimento: string
  cantidad_gramos: number
  calorias: number
  timestamp: string
}

export interface Workout {
  id: string
  user_id: string
  fecha: string
  tipo: WorkoutType
  duracion_minutos: number
  calorias_quemadas: number
}

export interface UserProfile {
  id: string
  user_id: string
  nombre: string
  fecha_nacimiento: string | null
  peso: number | null
  altura: number | null
}

export interface OpenFoodFactsProduct {
  product_name: string
  nutriments: {
    'energy-kcal_100g'?: number
    'energy_100g'?: number
  }
}

export const WORKOUT_TYPES: Record<WorkoutType, { label: string; baseKcal: number; baseMinutes: number }> = {
  boxeo_tecnica: { label: 'Boxeo técnica', baseKcal: 400, baseMinutes: 60 },
  boxeo_fisico: { label: 'Boxeo con físico', baseKcal: 600, baseMinutes: 60 },
  sparring: { label: 'Sparring', baseKcal: 700, baseMinutes: 60 },
  pesas: { label: 'Pesas', baseKcal: 350, baseMinutes: 60 },
  boxeo_pesas: { label: 'Boxeo + Pesas', baseKcal: 900, baseMinutes: 120 },
  descanso: { label: 'Descanso', baseKcal: 0, baseMinutes: 0 },
}

export const MEAL_LABELS: Record<MealSection, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  comida: 'Comida',
  pre_entreno: 'Pre-entreno',
  post_entreno: 'Post-entreno',
  cena: 'Cena',
}
