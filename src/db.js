/**
 * This file re-exports all data access functions from the data adapter.
 *
 * The data adapter routes operations to either Dexie (local-only) or
 * Firestore (cloud with offline persistence) based on auth state.
 *
 * Importing from './db' works exactly as before — no App.jsx changes needed.
 *
 * Additionally, this module retains pure utility functions (normalizeText,
 * toDateKey, adjustDateByDays, etc.) that don't need Firebase.
 */
import {
  searchFoods as _searchFoods,
  getAllFoods as _getAllFoods,
  addFood as _addFood,
  bulkPutFoods as _bulkPutFoods,
  getAllMeals as _getAllMeals,
  addMeal as _addMeal,
  updateMeal as _updateMeal,
  deleteMeal as _deleteMeal,
  addLog as _addLog,
  getLogsForDate as _getLogsForDate,
  getLogsBetweenDates as _getLogsBetweenDates,
  updateLog as _updateLog,
  deleteLog as _deleteLog,
  getRecentLogEntries as _getRecentLogEntries,
  addExercise as _addExercise,
  updateExercise as _updateExercise,
  deleteExercise as _deleteExercise,
  getExercisesForDate as _getExercisesForDate,
  getExercisesBetweenDates as _getExercisesBetweenDates,
  getSettings as _getSettings,
  saveSettings as _saveSettings,
  getMeta as _getMeta,
  putMeta as _putMeta,
  exportAllData as _exportAllData,
  restoreAllData as _restoreAllData,
} from './dataAdapter'

// Create local bindings so internal functions can use them
export const searchFoods = _searchFoods
export const getAllFoods = _getAllFoods
export const addFood = _addFood
export const bulkPutFoods = _bulkPutFoods
export const getAllMeals = _getAllMeals
export const addMeal = _addMeal
export const updateMeal = _updateMeal
export const deleteMeal = _deleteMeal
export const addLog = _addLog
export const getLogsForDate = _getLogsForDate
export const getLogsBetweenDates = _getLogsBetweenDates
export const updateLog = _updateLog
export const deleteLog = _deleteLog
export const getRecentLogEntries = _getRecentLogEntries
export const addExercise = _addExercise
export const updateExercise = _updateExercise
export const deleteExercise = _deleteExercise
export const getExercisesForDate = _getExercisesForDate
export const getExercisesBetweenDates = _getExercisesBetweenDates
export const getSettings = _getSettings
export const saveSettings = _saveSettings
export const getMeta = _getMeta
export const putMeta = _putMeta
export const exportAllData = _exportAllData
export const restoreAllData = _restoreAllData

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

const SEED_VERSION = 4

const buildSeedMergePlan = (existingFoods, incomingBaseFoods) => {
  const existingById = new Map(existingFoods.map((food) => [food.id, food]))
  const existingBaseBySearchName = new Map(
    existingFoods.filter((food) => food.source === 'base').map((food) => [food.searchName, food]),
  )

  let adds = 0
  let updates = 0
  let unchanged = 0
  let idConflicts = 0

  const preparedFoods = incomingBaseFoods.map((food) => {
    const existingBySameId = food.id != null ? existingById.get(food.id) : null
    const existingBaseByName = existingBaseBySearchName.get(food.searchName)

    if (existingBaseByName?.id != null) {
      const merged = { ...food, id: existingBaseByName.id }
      const hadChanges = JSON.stringify(existingBaseByName) !== JSON.stringify(merged)
      if (hadChanges) updates += 1
      else unchanged += 1
      return merged
    }

    if (existingBySameId && existingBySameId.source !== 'base') {
      const { id, ...foodWithoutId } = food
      idConflicts += 1
      adds += 1
      return foodWithoutId
    }

    if (existingBySameId) updates += 1
    else adds += 1

    return food
  })

  return {
    preparedFoods,
    summary: {
      incoming: incomingBaseFoods.length,
      adds,
      updates,
      unchanged,
      idConflicts,
      changes: adds + updates,
    },
  }
}

export const getSeedStatus = async () => {
  const [seedVersionMeta, seedSyncedAtMeta] = await Promise.all([
    getMeta('seedVersion'),
    getMeta('seedSyncedAt'),
  ])

  return {
    currentVersion: seedVersionMeta?.value ?? null,
    latestVersion: SEED_VERSION,
    lastSyncedAt: seedSyncedAtMeta?.value ?? null,
  }
}

export const ensureSeedData = async ({ previewOnly = false } = {}) => {
  const seedMeta = await getMeta('seedVersion')
  const isVersionCurrent = seedMeta?.value === SEED_VERSION
  if (isVersionCurrent && !previewOnly) {
    return
  }

  const response = await fetch(`${import.meta.env.BASE_URL}foods.json`)
  const baseFoods = await response.json()

  const normalizedFoods = baseFoods.map((food) => ({
    ...food,
    searchName: normalizeText(food.name),
    source: 'base',
  }))

  const existingFoods = await getAllFoods()
  const plan = buildSeedMergePlan(existingFoods, normalizedFoods)

  if (previewOnly) {
    return {
      updated: false,
      summary: plan.summary,
      seedVersion: SEED_VERSION,
    }
  }

  if (isVersionCurrent && plan.summary.changes === 0) {
    return {
      updated: false,
      summary: plan.summary,
      seedVersion: SEED_VERSION,
    }
  }

  // Merge-only update: add new base rows and update changed base rows without deleting user data.
  await bulkPutFoods(plan.preparedFoods)
  await putMeta({ key: 'seedVersion', value: SEED_VERSION })
  await putMeta({ key: 'seedSyncedAt', value: new Date().toISOString() })

  return {
    updated: plan.summary.changes > 0,
    summary: plan.summary,
    seedVersion: SEED_VERSION,
  }
}