import Dexie from 'dexie'

const SEED_VERSION = 2

class CaloriesDB extends Dexie {
  constructor() {
    super('CaloriesCoachDB')

    this.version(1).stores({
      foods: '++id, name, searchName, source',
      meals: '++id, name, searchName',
      logs: '++id, dateKey, timestamp',
      settings: '&key',
      meta: '&key',
    })

    this.version(2).stores({
      foods: '++id, name, searchName, source',
      meals: '++id, name, searchName',
      logs: '++id, dateKey, timestamp',
      exercises: '++id, dateKey, timestamp, type',
      settings: '&key',
      meta: '&key',
    })
  }
}

export const db = new CaloriesDB()

export const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')

const defaultSettings = {
  calorieGoal: 2200,
  proteinGoal: 140,
  carbsGoal: 220,
  fatGoal: 70,
  weightKg: 0,
  heightCm: 0,
  ageYears: 0,
  sex: 'male',
  projectionIntakeCalories: 2200,
  aiProvider: 'openai',
  openAiModel: 'gpt-4o-mini',
  geminiModel: 'gemini-1.5-flash',
  openAiApiKey: '',
  geminiApiKey: '',
}

export const toDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const adjustDateByDays = (date, diff) => {
  const d = new Date(date)
  d.setDate(d.getDate() + diff)
  return d
}

export const ensureSeedData = async () => {
  const seedMeta = await db.meta.get('seedVersion')
  if (seedMeta?.value === SEED_VERSION) {
    return
  }

  const response = await fetch(`${import.meta.env.BASE_URL}foods.json`)
  const baseFoods = await response.json()

  const normalizedFoods = baseFoods.map((food) => ({
    ...food,
    searchName: normalizeText(food.name),
    source: 'base',
  }))

  await db.transaction('rw', db.foods, db.meta, async () => {
    await db.foods.where('source').equals('base').delete()
    await db.foods.bulkAdd(normalizedFoods)
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}

export const getSettings = async () => {
  const rows = await db.settings.toArray()
  const mapped = rows.reduce((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})
  return { ...defaultSettings, ...mapped }
}

export const saveSettings = async (nextSettings) => {
  const updates = Object.entries(nextSettings).map(([key, value]) => ({ key, value }))
  await db.settings.bulkPut(updates)
}

export const searchFoods = async (query, limit = 20) => {
  const normalized = normalizeText(query)

  if (!normalized) {
    return db.foods.orderBy('name').limit(limit).toArray()
  }

  const startsWith = await db.foods.where('searchName').startsWith(normalized).limit(limit).toArray()
  if (startsWith.length >= limit) {
    return startsWith
  }

  const fallback = await db.foods
    .filter((food) => food.searchName.includes(normalized))
    .limit(limit - startsWith.length)
    .toArray()

  return [...startsWith, ...fallback]
}

export const getAllMeals = async () => db.meals.orderBy('name').toArray()

export const getLogsForDate = async (dateKey) =>
  db.logs.where('dateKey').equals(dateKey).toArray()

export const getLogsBetweenDates = async (startDateKey, endDateKey) =>
  db.logs.where('dateKey').between(startDateKey, endDateKey, true, true).toArray()

export const getExercisesForDate = async (dateKey) =>
  db.exercises.where('dateKey').equals(dateKey).toArray()

export const getExercisesBetweenDates = async (startDateKey, endDateKey) =>
  db.exercises.where('dateKey').between(startDateKey, endDateKey, true, true).toArray()

export const getRecentLogEntries = async (limit = 8) => {
  const rows = await db.logs.orderBy('timestamp').reverse().limit(limit * 8).toArray()
  const result = []
  const seen = new Set()

  for (const row of rows) {
    if (row.type === 'food' && row.foodId) {
      const key = `food:${row.foodId}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        key,
        type: 'food',
        foodId: row.foodId,
        label: row.foodName || row.description || 'Food',
        amount: Number(row.amount) || 1,
        unit: row.unit || 'g',
      })
    }

    if (row.type === 'meal' && row.mealId) {
      const key = `meal:${row.mealId}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        key,
        type: 'meal',
        mealId: row.mealId,
        label: row.mealName || row.description || 'Meal',
      })
    }

    if (result.length >= limit) {
      break
    }
  }

  return result
}

export const exportAllData = async () => {
  const [foods, meals, logs, exercises, settings, meta] = await Promise.all([
    db.foods.toArray(),
    db.meals.toArray(),
    db.logs.toArray(),
    db.exercises.toArray(),
    db.settings.toArray(),
    db.meta.toArray(),
  ])

  return {
    exportedAt: new Date().toISOString(),
    app: 'Calories Coach',
    version: 1,
    data: { foods, meals, logs, exercises, settings, meta },
  }
}

export const restoreAllData = async (backup) => {
  if (!backup?.data) {
    throw new Error('Invalid backup file format.')
  }

  const { foods = [], meals = [], logs = [], exercises = [], settings = [], meta = [] } = backup.data

  await db.transaction('rw', db.foods, db.meals, db.logs, db.exercises, db.settings, db.meta, async () => {
    await db.foods.clear()
    await db.meals.clear()
    await db.logs.clear()
    await db.exercises.clear()
    await db.settings.clear()
    await db.meta.clear()

    if (foods.length) await db.foods.bulkAdd(foods)
    if (meals.length) await db.meals.bulkAdd(meals)
    if (logs.length) await db.logs.bulkAdd(logs)
    if (exercises.length) await db.exercises.bulkAdd(exercises)
    if (settings.length) await db.settings.bulkAdd(settings)
    if (meta.length) await db.meta.bulkAdd(meta)
  })
}
