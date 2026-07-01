import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToAuth, handleLogout } from './services/auth'
import {
  FaCamera,
  FaGear,
  FaHouse,
  FaListCheck,
  FaPen,
  FaPlus,
  FaTrash,
} from 'react-icons/fa6'
import {
  adjustDateByDays,
  addFood,
  addLog,
  addMeal,
  addExercise,
  ensureSeedData,
  exportAllData,
  getAllFoods,
  getAllMeals,
  getExercisesBetweenDates,
  getExercisesForDate,
  getLogsBetweenDates,
  getLogsForDate,
  getRecentLogEntries,
  getSeedStatus,
  getSettings,
  normalizeText,
  restoreAllData,
  saveSettings,
  toDateKey,
  updateLog,
  updateMeal,
  updateExercise,
  // db*Delete functions are used inside local wrappers (deleteLog, deleteMeal, deleteExercise)
  deleteLog as dbDeleteLog,
  deleteMeal as dbDeleteMeal,
  deleteExercise as dbDeleteExercise,
} from './db'

import {
  DashboardActivity,
  DashboardOverview,
  DashboardTrends,
  DateNavigatorCard,
} from './components/dashboard-sections'
import { estimateNutritionFromImage } from './services/ai'
import { ProgressRing } from './components/ProgressRing'
import { LoadingButton } from './components/LoadingButton'
import { SegmentedTabs } from './components/SegmentedTabs'
import { SectionLoader } from './components/SectionLoader'
import { BottomSheet } from './components/BottomSheet'
import { TopSheet } from './components/TopSheet'
import { DashboardPage } from './pages/DashboardPage'
import { LogPage } from './pages/LogPage'
import { MealsPage } from './pages/MealsPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { Snackbar, showSnackbar } from './components/Snackbar'

const macroColors = {
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat',
}

const defaultCustomFood = {
  name: '',
  caloriesPer100g: 0,
  proteinPer100g: 0,
  carbsPer100g: 0,
  fatPer100g: 0,
  tbsp: 15,
  cup: 240,
  piece: 60,
}

const createEmptyMealItem = () => ({
  foodId: '',
  amount: 1,
  unit: 'g',
})

const getFoodUnits = (food) => food?.servings || [{ label: 'g', grams: 1 }]

const calculateFoodNutrition = (food, amount, unit) => {
  const selectedUnit = getFoodUnits(food).find((serving) => serving.label === unit)
  const grams = (Number(amount) || 0) * (selectedUnit?.grams || 1)
  const factor = grams / 100

  return {
    grams,
    calories: Number(((food.nutrition_per_100g?.calories ?? 0) * factor).toFixed(1)),
    protein: Number(((food.nutrition_per_100g?.proteins ?? 0) * factor).toFixed(1)),
    carbs: Number(((food.nutrition_per_100g?.carbs ?? 0) * factor).toFixed(1)),
    fat: Number(((food.nutrition_per_100g?.fats ?? 0) * factor).toFixed(1)),
  }
}

const formatDisplayDate = (date) =>
  date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

const sumNutrition = (rows) =>
  rows.reduce(
    (acc, row) => ({
      calories: acc.calories + (row.calories || 0),
      protein: acc.protein + (row.protein || 0),
      carbs: acc.carbs + (row.carbs || 0),
      fat: acc.fat + (row.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

const sumExerciseBurn = (rows) => rows.reduce((acc, row) => acc + (Number(row.caloriesBurned) || 0), 0)

const calculateBmi = (weightKg, heightCm) => {
  const w = Number(weightKg) || 0
  const h = Number(heightCm) || 0
  if (w <= 0 || h <= 0) return null
  const heightM = h / 100
  return Number((w / (heightM * heightM)).toFixed(1))
}

const calculateRestCalories = ({ weightKg, heightCm, ageYears, sex }) => {
  const weight = Number(weightKg) || 0
  const height = Number(heightCm) || 0
  const age = Number(ageYears) || 0
  if (weight <= 0 || height <= 0 || age <= 0) return null

  const base = 10 * weight + 6.25 * height - 5 * age
  const sexAdjustment = sex === 'female' ? -161 : 5
  return Math.round(base + sexAdjustment)
}

const exerciseMetByType = {
  walking: 3.8,
  jogging: 7,
  cycling: 7.5,
  weights: 5,
  hiit: 8.5,
}

const estimateExerciseCalories = ({ type, minutes, weightKg }) => {
  const met = exerciseMetByType[type] || 4
  const mins = Number(minutes) || 0
  const weight = Number(weightKg) || 0
  if (mins <= 0 || weight <= 0) return 0
  return Math.round((met * 3.5 * weight * mins) / 200)
}

const buildDateKeys = (endDate, daysCount) => {
  const keys = []
  for (let i = daysCount - 1; i >= 0; i -= 1) {
    keys.push(toDateKey(adjustDateByDays(endDate, -i)))
  }
  return keys
}

function App() {
  const [firebaseUser, setFirebaseUser] = useState(undefined)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setFirebaseUser(user)
      setAuthReady(true)
    })
    return unsubscribe
  }, [])

  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboardView, setDashboardView] = useState('overview')
  const [logView, setLogView] = useState('quick')
  const [settingsView, setSettingsView] = useState('targets')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [logs, setLogs] = useState([])
  const [exercises, setExercises] = useState([])
  const [dailyHistory, setDailyHistory] = useState([])
  const [foods, setFoods] = useState([])
  const [meals, setMeals] = useState([])
  const [settings, setSettings] = useState(null)
  const [seedStatus, setSeedStatus] = useState({ currentVersion: null, latestVersion: null, lastSyncedAt: null })
  const [seedPreview, setSeedPreview] = useState(null)
  const [pwaUpdateStatus, setPwaUpdateStatus] = useState(() => window.__caloriesPwaUpdateStatus || 'idle')

  const [logQuery, setLogQuery] = useState('')
  const [selectedLoggable, setSelectedLoggable] = useState(null)
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const [recentLogEntries, setRecentLogEntries] = useState([])
  const [foodAmount, setFoodAmount] = useState(1)
  const [foodUnit, setFoodUnit] = useState('g')

  const [foodSheetOpen, setFoodSheetOpen] = useState(false)
  const [customFoodSheetOpen, setCustomFoodSheetOpen] = useState(false)
  const [mealSheetOpen, setMealSheetOpen] = useState(false)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [exerciseSheetOpen, setExerciseSheetOpen] = useState(false)

  const [customFood, setCustomFood] = useState(defaultCustomFood)
  const [mealName, setMealName] = useState('')
  const [mealItems, setMealItems] = useState([createEmptyMealItem()])
  const [editingMealId, setEditingMealId] = useState(null)
  const [mealFoodQuery, setMealFoodQuery] = useState('')
  const [mealFoodAutocompleteOpen, setMealFoodAutocompleteOpen] = useState(false)
  const [mealItemBeingEdited, setMealItemBeingEdited] = useState(null)

  const [aiDataUrl, setAiDataUrl] = useState('')
  const [aiEstimate, setAiEstimate] = useState({ description: '', calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [aiLoading, setAiLoading] = useState(false)

  const [editingExercise, setEditingExercise] = useState(null)
  const [exerciseForm, setExerciseForm] = useState({
    type: 'walking',
    minutes: 30,
    caloriesBurned: '',
    notes: '',
  })

  const [editingLog, setEditingLog] = useState(null)
  const logSearchInputRef = useRef(null)
  const mealSearchInputRef = useRef(null)
  const touchGestureRef = useRef({ x: 0, y: 0, active: false, pointerId: null })
  const swipeTimerRef = useRef(null)
  const swipeTransitionTimerRef = useRef(null)
  const [loadingAction, setLoadingAction] = useState('')
  const [isDayLoading, setIsDayLoading] = useState(false)
  const [swipeOffsetX, setSwipeOffsetX] = useState(0)
  const [isSwipeDragging, setIsSwipeDragging] = useState(false)
  const [swipeTransition, setSwipeTransition] = useState(null)

  const isActionLoading = useCallback((key) => loadingAction === key, [loadingAction])
  const runLoadingAction = useCallback(async (key, operation) => {
    setLoadingAction(key)
    try {
      await operation()
    } finally {
      setLoadingAction('')
    }
  }, [])
  const isUpdateAvailable = pwaUpdateStatus === 'available'

  const formatDateTime = useCallback((value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const dateKey = useMemo(() => toDateKey(selectedDate), [selectedDate])
  const totals = useMemo(() => sumNutrition(logs), [logs])
  const exerciseBurn = useMemo(() => sumExerciseBurn(exercises), [exercises])
  const bmi = useMemo(() => calculateBmi(settings?.weightKg, settings?.heightCm), [settings])
  const restingCalories = useMemo(() => calculateRestCalories(settings || {}), [settings])
  const totalBurn = useMemo(() => (restingCalories || 0) + exerciseBurn, [exerciseBurn, restingCalories])
  const calorieBalance = useMemo(() => totalBurn - totals.calories, [totalBurn, totals.calories])
  const estimatedExerciseBurn = useMemo(
    () => estimateExerciseCalories({ type: exerciseForm.type, minutes: exerciseForm.minutes, weightKg: settings?.weightKg }),
    [exerciseForm.minutes, exerciseForm.type, settings],
  )
  const projectionScenarios = useMemo(() => {
    const weight = Number(settings?.weightKg) || 0
    const burn = totalBurn || 0
    if (!weight || !burn) return []

    const baseIntake = Number(settings?.projectionIntakeCalories) || Number(settings?.calorieGoal) || burn
    const intakes = [Math.max(900, baseIntake - 400), baseIntake, baseIntake + 400]

    return intakes.map((intake) => {
      const deltaPerDay = burn - intake
      const in30 = Number((weight - (deltaPerDay * 30) / 7700).toFixed(1))
      const in90 = Number((weight - (deltaPerDay * 90) / 7700).toFixed(1))
      return {
        intake,
        deltaPerDay,
        in30,
        in90,
      }
    })
  }, [settings, totalBurn])
  const selectedFood = useMemo(() => {
    if (selectedLoggable?.type !== 'food') return null
    return foods.find((food) => String(food.id) === String(selectedLoggable.id)) || null
  }, [foods, selectedLoggable])
  const selectedMeal = useMemo(() => {
    if (selectedLoggable?.type !== 'meal') return null
    return meals.find((meal) => String(meal.id) === String(selectedLoggable.id)) || null
  }, [meals, selectedLoggable])
  const selectedFoodNutrition = useMemo(() => {
    if (!selectedFood) return null
    return calculateFoodNutrition(selectedFood, foodAmount, foodUnit)
  }, [foodAmount, foodUnit, selectedFood])
  const loggableIndex = useMemo(() => {
    const mealRows = meals.map((meal) => ({
      id: meal.id,
      type: 'meal',
      label: meal.name,
      searchText: normalizeText(`${meal.name} ${(meal.items || []).map((item) => item.foodName).join(' ')}`),
    }))

    const foodRows = foods.map((food) => ({
      id: food.id,
      type: 'food',
      label: food.name,
      searchText: normalizeText(food.name),
    }))

    return [...mealRows, ...foodRows]
  }, [foods, meals])
  const autocompleteResults = useMemo(() => {
    const normalized = normalizeText(logQuery)
    const maxResults = 24

    if (!normalized) {
      const topMeals = loggableIndex.filter((row) => row.type === 'meal').slice(0, 8)
      const topFoods = loggableIndex.filter((row) => row.type === 'food').slice(0, maxResults - topMeals.length)
      return [...topMeals, ...topFoods]
    }

    const ranked = loggableIndex
      .map((row) => {
        let score = 0
        if (row.type === 'meal') score += 2000
        if (row.searchText.startsWith(normalized)) score += 1000
        if (row.searchText.includes(normalized)) score += 300
        if (!row.searchText.includes(normalized)) score = -1

        return { ...row, score }
      })
      .filter((row) => row.score >= 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))

    return ranked.slice(0, maxResults)
  }, [logQuery, loggableIndex])

  const mealFoodAutocompleteResults = useMemo(() => {
    const normalized = normalizeText(mealFoodQuery)
    const maxResults = 24
    const foodIndex = foods.map((food) => ({
      id: food.id,
      type: 'food',
      label: food.name,
      searchText: normalizeText(food.name),
    }))

    if (!normalized) {
      return foodIndex.slice(0, maxResults)
    }

    const ranked = foodIndex
      .map((row) => {
        let score = 0
        if (row.searchText.startsWith(normalized)) score += 1000
        if (row.searchText.includes(normalized)) score += 300
        if (!row.searchText.includes(normalized)) score = -1

        return { ...row, score }
      })
      .filter((row) => row.score >= 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))

    return ranked.slice(0, maxResults)
  }, [mealFoodQuery, foods])

  const loadFoods = useCallback(async () => {
    const allFoods = await getAllFoods()
    setFoods(allFoods)
  }, [])

  const loadDateLogs = useCallback(async (key) => {
    const rows = await getLogsForDate(key)
    const sorted = [...rows].sort((a, b) => b.timestamp - a.timestamp)
    setLogs(sorted)
  }, [])

  const loadDateExercises = useCallback(async (key) => {
    const rows = await getExercisesForDate(key)
    const sorted = [...rows].sort((a, b) => b.timestamp - a.timestamp)
    setExercises(sorted)
  }, [])

  const loadDailyHistory = useCallback(
    async (anchorDate, restCalories) => {
      const keys = buildDateKeys(anchorDate, 10)
      const startKey = keys[0]
      const endKey = keys[keys.length - 1]
      const [logRows, exerciseRows] = await Promise.all([
        getLogsBetweenDates(startKey, endKey),
        getExercisesBetweenDates(startKey, endKey),
      ])

      const logsByDate = logRows.reduce((acc, row) => {
        const current = acc[row.dateKey] || 0
        acc[row.dateKey] = current + (Number(row.calories) || 0)
        return acc
      }, {})

      const exerciseByDate = exerciseRows.reduce((acc, row) => {
        const current = acc[row.dateKey] || 0
        acc[row.dateKey] = current + (Number(row.caloriesBurned) || 0)
        return acc
      }, {})

      const history = keys.map((key) => {
        const consumed = logsByDate[key] || 0
        const burned = (Number(restCalories) || 0) + (exerciseByDate[key] || 0)
        return {
          dateKey: key,
          consumed,
          burned,
          balance: burned - consumed,
        }
      })

      setDailyHistory(history)
    },
    [],
  )

  const loadRecentEntries = useCallback(async () => {
    setRecentLogEntries(await getRecentLogEntries(20))
  }, [])

  const loadSeedSyncStatus = useCallback(async () => {
    setSeedStatus(await getSeedStatus())
  }, [])

  const bootstrap = useCallback(async () => {
    await ensureSeedData()
    const [savedSettings, savedMeals] = await Promise.all([getSettings(), getAllMeals()])
    setSettings(savedSettings)
    setMeals(savedMeals)
    const today = new Date()
    const todayKey = toDateKey(today)
    await Promise.all([
      loadFoods(),
      loadDateLogs(todayKey),
      loadDateExercises(todayKey),
      loadRecentEntries(),
      loadSeedSyncStatus(),
      loadDailyHistory(today, calculateRestCalories(savedSettings)),
    ])
  }, [loadDailyHistory, loadDateExercises, loadDateLogs, loadFoods, loadRecentEntries, loadSeedSyncStatus])

  useEffect(() => {
    // Only run bootstrap after we know the auth state.
    // If signed in, firebaseUser is set and dataAdapter uses Firestore.
    // If signed out, the LoginPage will be shown, skip bootstrap.
    if (!authReady || !firebaseUser) return

    bootstrap().catch((error) => {
      alert(error.message)
    })
  }, [authReady, firebaseUser, bootstrap])

  useEffect(() => {
    setIsDayLoading(true)
    Promise.all([loadDateLogs(dateKey), loadDateExercises(dateKey)])
      .catch((error) => alert(error.message))
      .finally(() => setIsDayLoading(false))
  }, [dateKey, loadDateExercises, loadDateLogs])

  useEffect(() => {
    if (!settings) return
    loadDailyHistory(selectedDate, calculateRestCalories(settings)).catch((error) => alert(error.message))
  }, [loadDailyHistory, selectedDate, settings])

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) {
        window.clearTimeout(swipeTimerRef.current)
      }
      if (swipeTransitionTimerRef.current) {
        window.clearTimeout(swipeTransitionTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!foodSheetOpen) return
    const timer = window.setTimeout(() => {
      if (logSearchInputRef.current) {
        logSearchInputRef.current.focus()
      }
      setIsAutocompleteOpen(true)
    }, 90)

    return () => window.clearTimeout(timer)
  }, [foodSheetOpen])

  useEffect(() => {
    const handlePwaUpdateStatus = (event) => {
      const nextStatus = event?.detail?.status
      if (!nextStatus) return
      setPwaUpdateStatus(nextStatus)
    }

    window.addEventListener('calories-pwa-update-status', handlePwaUpdateStatus)
    return () => window.removeEventListener('calories-pwa-update-status', handlePwaUpdateStatus)
  }, [])

  const resetFoodForm = () => {
    setSelectedLoggable(null)
    setFoodAmount(1)
    setFoodUnit('g')
    setLogQuery('')
    setIsAutocompleteOpen(false)
  }

  const addFoodLogEntry = useCallback(
    async (food, amount, unit) => {
      const nutrition = calculateFoodNutrition(food, amount, unit)
      await addLog({
        dateKey,
        timestamp: Date.now(),
        type: 'food',
        foodId: food.id,
        foodName: food.name,
        unit,
        amount: Number(amount),
        ...nutrition,
        description: `${food.name} (${amount} ${unit})`,
      })
      await Promise.all([loadDateLogs(dateKey), loadRecentEntries(), loadDailyHistory(selectedDate, restingCalories)])
    },
    [dateKey, loadDailyHistory, loadDateLogs, loadRecentEntries, restingCalories, selectedDate],
  )

  const selectAutocompleteResult = (result) => {
    setSelectedLoggable({ type: result.type, id: String(result.id) })
    setLogQuery(result.label)
    setIsAutocompleteOpen(false)

    if (result.type === 'food') {
      const food = foods.find((row) => String(row.id) === String(result.id))
      setFoodUnit(food?.servings?.[0]?.label || 'g')
    }
  }

  const saveFoodLog = async () => {
    await runLoadingAction('save-food-log', async () => {
      if (!selectedLoggable) return

      if (selectedLoggable.type === 'meal') {
        if (!selectedMeal) return
        await logMeal(selectedMeal)
        resetFoodForm()
        setFoodSheetOpen(false)
        return
      }

      if (!selectedFood || !selectedFoodNutrition) return
      await addFoodLogEntry(selectedFood, foodAmount, foodUnit)
      resetFoodForm()
      setFoodSheetOpen(false)
    })
  }

  const saveCustomFood = async () => {
    await runLoadingAction('save-custom-food', async () => {
      if (!customFood.name.trim()) return

      const servings = [
        { label: 'g', grams: 1 },
        { label: 'tbsp', grams: Number(customFood.tbsp) || 0 },
        { label: 'cup', grams: Number(customFood.cup) || 0 },
        { label: 'piece', grams: Number(customFood.piece) || 0 },
      ].filter((row) => row.grams > 0)

      await addFood({
        name: customFood.name.trim(),
        searchName: normalizeText(customFood.name),
        source: 'custom',
        nutrition_per_100g: {
          calories: Number(customFood.caloriesPer100g) || 0,
          proteins: Number(customFood.proteinPer100g) || 0,
          carbs: Number(customFood.carbsPer100g) || 0,
          fats: Number(customFood.fatPer100g) || 0,
        },
        servings,
        createdAt: Date.now(),
      })

      setCustomFood(defaultCustomFood)
      setCustomFoodSheetOpen(false)
      await loadFoods()
    })
  }

  const saveMeal = async () => {
    await runLoadingAction('save-meal', async () => {
      if (!mealName.trim()) return

    const foodMap = Object.fromEntries(foods.map((food) => [String(food.id), food]))
    const itemRows = mealItems
      .map((item) => {
        const food = foodMap[item.foodId]
        if (!food) return null
        const nutrition = calculateFoodNutrition(food, item.amount, item.unit)
        return {
          foodId: food.id,
          foodName: food.name,
          amount: Number(item.amount),
          unit: item.unit,
          ...nutrition,
        }
      })
      .filter(Boolean)

      if (!itemRows.length) return

      const totalsRow = sumNutrition(itemRows)

      if (editingMealId) {
        await updateMeal(editingMealId, {
          name: mealName.trim(),
          searchName: normalizeText(mealName),
          items: itemRows,
          totals: totalsRow,
        })
      } else {
        await addMeal({
          name: mealName.trim(),
          searchName: normalizeText(mealName),
          items: itemRows,
          totals: totalsRow,
          createdAt: Date.now(),
        })
      }

      setMealName('')
      setMealItems([createEmptyMealItem()])
      setEditingMealId(null)
      setMealSheetOpen(false)
      setMeals(await getAllMeals())
    })
  }

  const openCreateMeal = () => {
    setEditingMealId(null)
    setMealName('')
    setMealItems([createEmptyMealItem()])
    setMealFoodQuery('')
    setMealFoodAutocompleteOpen(false)
    setMealItemBeingEdited(null)
    setMealSheetOpen(true)
  }

  const openEditMeal = (meal) => {
    setEditingMealId(meal.id)
    setMealName(meal.name || '')
    setMealItems(
      (meal.items || []).length
        ? meal.items.map((item) => ({
            foodId: String(item.foodId || ''),
            amount: Number(item.amount) || 1,
            unit: item.unit || 'g',
          }))
        : [createEmptyMealItem()],
    )
    setMealSheetOpen(true)
  }

  const deleteMeal = async (mealId) => {
    await dbDeleteMeal(mealId)
    setMeals(await getAllMeals())
  }

  const logMeal = async (meal) => {
      await addLog({
        dateKey,
        timestamp: Date.now(),
        type: 'meal',
      mealId: meal.id,
      mealName: meal.name,
      description: meal.name,
      calories: Number(meal.totals?.calories || 0),
      protein: Number(meal.totals?.protein || 0),
      carbs: Number(meal.totals?.carbs || 0),
      fat: Number(meal.totals?.fat || 0),
    })
    await Promise.all([loadDateLogs(dateKey), loadRecentEntries(), loadDailyHistory(selectedDate, restingCalories)])
  }

  const quickAddRecent = async (entry) => {
    await runLoadingAction(`quick-add-${entry.key}`, async () => {
      if (entry.type === 'meal') {
        const meal = meals.find((row) => row.id === entry.mealId)
        if (meal) await logMeal(meal)
        return
      }

      const food = foods.find((row) => row.id === entry.foodId)
      if (!food) return
      const unit = entry.unit || food.servings?.[0]?.label || 'g'
      const amount = Number(entry.amount) || 1
      await addFoodLogEntry(food, amount, unit)
    })
  }

  const deleteLog = async (id) => {
    await dbDeleteLog(id)
    await Promise.all([loadDateLogs(dateKey), loadRecentEntries(), loadDailyHistory(selectedDate, restingCalories)])
  }

  const saveEditedLog = async () => {
    await runLoadingAction('save-edited-log', async () => {
      if (!editingLog) return

      await updateLog(editingLog.id, {
        description: editingLog.description,
        calories: Number(editingLog.calories) || 0,
        protein: Number(editingLog.protein) || 0,
        carbs: Number(editingLog.carbs) || 0,
        fat: Number(editingLog.fat) || 0,
      })

      setEditSheetOpen(false)
      setEditingLog(null)
      await Promise.all([loadDateLogs(dateKey), loadRecentEntries(), loadDailyHistory(selectedDate, restingCalories)])
    })
  }

  const openExerciseCreate = () => {
    setEditingExercise(null)
    setExerciseForm({ type: 'walking', minutes: 30, caloriesBurned: '', notes: '' })
    setExerciseSheetOpen(true)
  }

  const openExerciseEdit = (row) => {
    setEditingExercise(row)
    setExerciseForm({
      type: row.type || 'walking',
      minutes: Number(row.minutes) || 30,
      caloriesBurned: Number(row.caloriesBurned) || '',
      notes: row.notes || '',
    })
    setExerciseSheetOpen(true)
  }

  const saveExercise = async () => {
    await runLoadingAction('save-exercise', async () => {
      const minutes = Number(exerciseForm.minutes) || 0
      if (minutes <= 0) return

      const caloriesBurned = Number(exerciseForm.caloriesBurned) || estimatedExerciseBurn
      const payload = {
        dateKey,
        timestamp: Date.now(),
        type: exerciseForm.type,
        minutes,
        caloriesBurned,
        notes: exerciseForm.notes.trim(),
        description: `${exerciseForm.type} (${minutes} min)`,
      }

      if (editingExercise?.id) {
        await updateExercise(editingExercise.id, payload)
      } else {
        await addExercise(payload)
      }

      setExerciseSheetOpen(false)
      setEditingExercise(null)
      setExerciseForm({ type: 'walking', minutes: 30, caloriesBurned: '', notes: '' })

      await Promise.all([
        loadDateExercises(dateKey),
        loadDailyHistory(selectedDate, restingCalories),
      ])
    })
  }

  const deleteExercise = async (id) => {
    await dbDeleteExercise(id)
    await Promise.all([
      loadDateExercises(dateKey),
      loadDailyHistory(selectedDate, restingCalories),
    ])
  }

  const onAiFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setAiDataUrl(String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const runAiEstimate = async () => {
    if (!settings || !aiDataUrl) return

    const provider = settings.aiProvider
    const apiKey = provider === 'gemini' ? settings.geminiApiKey : settings.openAiApiKey
    const model = provider === 'gemini' ? settings.geminiModel : settings.openAiModel

    setAiLoading(true)
    try {
      const result = await estimateNutritionFromImage({ provider, apiKey, model, dataUrl: aiDataUrl })
      setAiEstimate(result)
    } catch (error) {
      alert(error.message)
    } finally {
      setAiLoading(false)
    }
  }

  const addAiEstimateToLog = async () => {
    await runLoadingAction('save-ai-entry', async () => {
      await addLog({
        dateKey,
        timestamp: Date.now(),
        type: 'ai',
        description: aiEstimate.description || 'AI estimate',
        calories: Number(aiEstimate.calories) || 0,
        protein: Number(aiEstimate.protein) || 0,
        carbs: Number(aiEstimate.carbs) || 0,
        fat: Number(aiEstimate.fat) || 0,
        grams: 0,
      })

      setAiEstimate({ description: '', calories: 0, protein: 0, carbs: 0, fat: 0 })
      setAiDataUrl('')
      setAiSheetOpen(false)
      await Promise.all([loadDateLogs(dateKey), loadDailyHistory(selectedDate, restingCalories)])
    })
  }

  const saveGoals = async () => {
    await runLoadingAction('save-settings', async () => {
      await saveSettings(settings)
      showSnackbar('Settings saved')
    })
  }

  const downloadBackup = async () => {
    await runLoadingAction('export-backup', async () => {
      const backup = await exportAllData()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `calories-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  const restoreBackup = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      await restoreAllData(parsed)
      await bootstrap()
      alert('Backup restored successfully.')
    } catch (error) {
      alert(`Restore failed: ${error.message}`)
    }
  }

  const updateAppNow = async () => {
    await runLoadingAction('update-app-now', async () => {
      if (typeof window.__caloriesForceAppUpdate !== 'function') {
        alert('App updater is unavailable in this session.')
        return
      }

      try {
        await window.__caloriesForceAppUpdate()
      } catch (error) {
        alert(error.message)
      }
    })
  }

  const previewSeedUpdate = async () => {
    await runLoadingAction('preview-seed-update', async () => {
      const result = await ensureSeedData({ previewOnly: true })
      setSeedPreview(result?.summary || null)
    })
  }

  const applySeedUpdate = async () => {
    await runLoadingAction('apply-seed-update', async () => {
      const result = await ensureSeedData()
      await Promise.all([loadFoods(), loadSeedSyncStatus()])

      if (result?.summary) {
        setSeedPreview(result.summary)
        if (result.summary.changes > 0) {
          alert('Food database updated successfully.')
        } else {
          alert('Food database is already up to date.')
        }
      } else {
        alert('Food database is already up to date.')
      }
    })
  }

  const shouldIgnoreSwipeTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false
    return Boolean(target.closest('input, select, textarea, button, a, label'))
  }

  const clearSwipeTimer = () => {
    if (!swipeTimerRef.current) return
    window.clearTimeout(swipeTimerRef.current)
    swipeTimerRef.current = null
  }

  const clearSwipeTransitionTimer = () => {
    if (!swipeTransitionTimerRef.current) return
    window.clearTimeout(swipeTransitionTimerRef.current)
    swipeTransitionTimerRef.current = null
  }

  const commitDateSwipe = (visualDirection, finalOffset = 0) => {
    const nextDate = adjustDateByDays(selectedDate, visualDirection > 0 ? -1 : 1)

    clearSwipeTransitionTimer()
    setSwipeTransition({
      direction: visualDirection,
      stage: 'prepare',
      dragOffset: finalOffset,
      outgoing: {
        selectedDate,
        dateKey,
        logs,
        exercises,
        dailyHistory,
        totals,
        bmi,
        restingCalories,
        totalBurn,
        calorieBalance,
        projectionScenarios,
        isDayLoading,
      },
    })

    setSelectedDate(nextDate)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setSwipeTransition((prev) => (prev ? { ...prev, stage: 'animate', dragOffset: 0 } : prev))
      })
    })

    swipeTransitionTimerRef.current = window.setTimeout(() => {
      setSwipeTransition(null)
      setSwipeOffsetX(0)
      swipeTransitionTimerRef.current = null
    }, 280)
  }

  const renderDashboardPanel = ({
    panelSelectedDate,
    panelDateKey,
    panelTotals,
    panelBmi,
    panelRestingCalories,
    panelTotalBurn,
    panelCalorieBalance,
    panelProjectionScenarios,
    panelDailyHistory,
    panelLogs,
    panelExercises,
    panelIsDayLoading,
  }) => (
    <div className="space-y-4">
      <DateNavigatorCard
        selectedDate={panelSelectedDate}
        dateKey={panelDateKey}
        formatDisplayDate={formatDisplayDate}
        onDateChange={setSelectedDate}
        onPrevDate={() => setSelectedDate((prev) => adjustDateByDays(prev, -1))}
        onNextDate={() => setSelectedDate((prev) => adjustDateByDays(prev, 1))}
      />

      <SegmentedTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'trends', label: 'Trends' },
          { id: 'activity', label: 'Activity' },
        ]}
        value={dashboardView}
        onChange={setDashboardView}
      />

      {panelIsDayLoading && <SectionLoader />}

      {!panelIsDayLoading && dashboardView === 'overview' && (
        <DashboardOverview
          settings={settings}
          totals={panelTotals}
          bmi={panelBmi}
          restingCalories={panelRestingCalories}
          totalBurn={panelTotalBurn}
          calorieBalance={panelCalorieBalance}
          macroColors={macroColors}
          logs={panelLogs}
          ring={<ProgressRing consumed={panelTotals.calories} goal={settings.calorieGoal} />}
          onLogFood={(entry) => {
            setSelectedLoggable({ type: 'food', id: String(entry.foodId) })
            setLogQuery(entry.foodName || '')
            setIsAutocompleteOpen(false)
            setFoodAmount(entry.amount)
            setFoodUnit(entry.unit || 'g')
            setFoodSheetOpen(true)
          }}
        />
      )}

      {!panelIsDayLoading && dashboardView === 'trends' && (
        <DashboardTrends projectionScenarios={panelProjectionScenarios} dailyHistory={panelDailyHistory} />
      )}

      {!panelIsDayLoading && dashboardView === 'activity' && (
        <DashboardActivity
          exercises={panelExercises}
          logs={panelLogs}
          onAddExercise={openExerciseCreate}
          onEditExercise={openExerciseEdit}
          onDeleteExercise={deleteExercise}
          onEditLog={(entry) => {
            setEditingLog(entry)
            setEditSheetOpen(true)
          }}
          onDeleteLog={deleteLog}
        />
      )}
    </div>
  )

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (swipeTransition) return

    clearSwipeTimer()

    if (shouldIgnoreSwipeTarget(event.target)) {
      touchGestureRef.current.active = false
      return
    }

    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    touchGestureRef.current = {
      x: event.clientX,
      y: event.clientY,
      active: true,
      pointerId: event.pointerId,
    }

    setIsSwipeDragging(true)
    setSwipeOffsetX(0)
  }

  const onPointerMove = (event) => {
    if (!touchGestureRef.current.active) return
    if (touchGestureRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - touchGestureRef.current.x
    const deltaY = event.clientY - touchGestureRef.current.y

    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return

    const clamped = Math.max(-88, Math.min(88, deltaX))
    setSwipeOffsetX(clamped)
  }

  const onPointerUp = (event) => {
    if (!touchGestureRef.current.active) return
    if (touchGestureRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - touchGestureRef.current.x
    const deltaY = event.clientY - touchGestureRef.current.y

    touchGestureRef.current.active = false
    touchGestureRef.current.pointerId = null
    setIsSwipeDragging(false)

    // Require a mostly-horizontal swipe to avoid vertical-scroll conflicts.
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
      setSwipeOffsetX(0)
      return
    }

    const visualDirection = deltaX > 0 ? 1 : -1
    commitDateSwipe(visualDirection, swipeOffsetX)
  }

  const onPointerCancel = () => {
    touchGestureRef.current.active = false
    touchGestureRef.current.pointerId = null
    setIsSwipeDragging(false)
    setSwipeOffsetX(0)
  }

  // Show nothing while auth state is still loading
  if (!authReady) {
    return null
  }

  // Show the login page when not signed in
  if (!firebaseUser) {
    return <LoginPage />
  }

  if (!settings) {
    return (
      <main className="phone-shell pb-24">
        <header className="px-4 pb-3 pt-5">
          <div className="h-7 w-40 rounded-xl bg-[#d9e8dd] skeleton-block"></div>
          <div className="mt-2 h-4 w-64 rounded-xl bg-[#e2efe6] skeleton-block"></div>
        </header>
        <section className="space-y-4 px-4">
          <SectionLoader />
          <SectionLoader />
          <SectionLoader />
        </section>
      </main>
    )
  }

  return (
    <main className="phone-shell pb-24">
      <header className="px-4 pb-3 pt-5">
        <h1 className="font-['Sora'] text-2xl font-bold text-[#163d31]">Calories Coach</h1>
        <p className="text-sm text-[#4c695b]">Offline-first nutrition tracking for your phone.</p>
      </header>

      <section className="px-4">
        {activeTab === 'dashboard' && (
          <DashboardPage
            selectedDate={selectedDate}
            dateKey={dateKey}
            dashboardView={dashboardView}
            setDashboardView={setDashboardView}
            totals={totals}
            bmi={bmi}
            restingCalories={restingCalories}
            totalBurn={totalBurn}
            calorieBalance={calorieBalance}
            projectionScenarios={projectionScenarios}
            dailyHistory={dailyHistory}
            logs={logs}
            exercises={exercises}
            isDayLoading={isDayLoading}
            settings={settings}
            macroColors={macroColors}
            onDateChange={setSelectedDate}
            onEditLog={(entry) => {
              setEditingLog({ ...entry })
              setEditSheetOpen(true)
            }}
            onDeleteLog={deleteLog}
            onAddExercise={openExerciseCreate}
            onEditExercise={openExerciseEdit}
            onDeleteExercise={deleteExercise}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            swipeOffsetX={swipeOffsetX}
            isSwipeDragging={isSwipeDragging}
            swipeTransition={swipeTransition}
            renderDashboardPanel={renderDashboardPanel}
          />
        )}

        {activeTab === 'log' && (
          <LogPage
            logView={logView}
            setLogView={setLogView}
            recentLogEntries={recentLogEntries}
            isActionLoading={isActionLoading}
            onSetFoodSheetOpen={(open) => {
              setFoodSheetOpen(open)
              if (open) setIsAutocompleteOpen(true)
            }}
            onSetCustomFoodSheetOpen={setCustomFoodSheetOpen}
            onSetAiSheetOpen={setAiSheetOpen}
            onOpenExerciseCreate={openExerciseCreate}
            quickAddRecent={quickAddRecent}
            onPreSelectEntry={(entry) => {
              if (entry.type === 'food') {
                setSelectedLoggable({ type: 'food', id: String(entry.foodId) })
                setLogQuery(entry.label)
                setFoodAmount(entry.amount)
                setFoodUnit(entry.unit || 'g')
              } else {
                setSelectedLoggable({ type: 'meal', id: String(entry.mealId) })
                setLogQuery(entry.label)
                setFoodAmount(1)
              }
              setIsAutocompleteOpen(false)
              setFoodSheetOpen(true)
            }}
          />
        )}

        {activeTab === 'meals' && (
          <MealsPage
            meals={meals}
            isActionLoading={isActionLoading}
            onOpenCreateMeal={openCreateMeal}
            onOpenEditMeal={openEditMeal}
            onDeleteMeal={deleteMeal}
            onLogMeal={logMeal}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            settingsView={settingsView}
            setSettingsView={setSettingsView}
            settings={settings}
            setSettings={setSettings}
            bmi={bmi}
            restingCalories={restingCalories}
            seedStatus={seedStatus}
            isUpdateAvailable={isUpdateAvailable}
            isActionLoading={isActionLoading}
            formatDateTime={formatDateTime}
            seedPreview={seedPreview}
            onPreviewSeedUpdate={previewSeedUpdate}
            onApplySeedUpdate={applySeedUpdate}
            onUpdateAppNow={updateAppNow}
            onSaveSettings={saveGoals}
            onDownloadBackup={downloadBackup}
            onRestoreBackup={restoreBackup}
          />
        )}
      </section>

      {firebaseUser && (
        <button
          className="fixed right-4 top-4 z-40 rounded-full bg-[#dbf1e5] px-3 py-1 text-xs font-semibold text-[#16543c]"
          onClick={handleLogout}
        >
          Sign out
        </button>
      )}

      {!foodSheetOpen && activeTab !== 'settings' && (
        <button
          className="fab-log-food"
          onClick={() => {
            setFoodSheetOpen(true)
            setIsAutocompleteOpen(true)
          }}
          aria-label="Log food"
        >
          <FaPlus />
          <span>Log Food</span>
        </button>
      )}

      <Snackbar />

      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-[#d9e3d8] bg-[#f5f9f2] px-2 py-2">
        {[
          { id: 'dashboard', label: 'Home', icon: <FaHouse /> },
          { id: 'log', label: 'Log', icon: <FaPlus /> },
          { id: 'meals', label: 'Meals', icon: <FaListCheck /> },
          { id: 'settings', label: 'Settings', icon: <FaGear /> },
        ].map((item) => (
          <button
            key={item.id}
            className={`grid place-items-center gap-1 rounded-2xl px-4 py-2 text-xs font-semibold ${
              activeTab === item.id ? 'bg-[#dbf1e5] text-[#16543c]' : 'text-[#537468]'
            }`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <TopSheet open={foodSheetOpen} title="Log Food" onClose={() => setFoodSheetOpen(false)}>
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#d9e7da] bg-white p-2">
            <input
              ref={logSearchInputRef}
              className="input !border-0 !bg-transparent !px-1 !py-2 !ring-0"
              placeholder="Search food or meal"
              value={logQuery}
              onFocus={() => setIsAutocompleteOpen(true)}
              onChange={(event) => {
                setLogQuery(event.target.value)
                setSelectedLoggable(null)
                setIsAutocompleteOpen(true)
              }}
            />
          </div>

          {isAutocompleteOpen && (
            <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-[#dbe7dc] bg-white p-2">
              {autocompleteResults.length === 0 && <p className="px-3 py-2 text-sm text-[#5c776a]">No matching food or meal.</p>}
              {autocompleteResults.map((row) => (
                <button
                  key={`${row.type}-${row.id}`}
                  className="mb-1 flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-[#dce8dd] hover:bg-[#eff7f0]"
                  onClick={() => selectAutocompleteResult(row)}
                >
                  <span className="text-[#1f4739]">{row.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.type === 'meal' ? 'bg-[#e7edf8] text-[#284d89]' : 'bg-[#e4f4e9] text-[#196342]'
                    }`}
                  >
                    {row.type === 'meal' ? 'Meal' : 'Food'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedLoggable?.type === 'meal' && selectedMeal && (
            <div className="rounded-2xl border border-[#dce7dc] bg-[#f8fcf9] p-3 text-sm text-[#36584a]">
              <p className="font-semibold">{selectedMeal.name}</p>
              <p>
                {Math.round(selectedMeal.totals?.calories || 0)} kcal | P {Number(selectedMeal.totals?.protein || 0).toFixed(1)} | C{' '}
                {Number(selectedMeal.totals?.carbs || 0).toFixed(1)} | F {Number(selectedMeal.totals?.fat || 0).toFixed(1)}
              </p>
            </div>
          )}

          {selectedLoggable?.type === 'food' && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#dce7dc] bg-[#f8fcf9] p-3">
              <label className="text-sm text-[#3d5f51]">
                Amount
                <input
                  type="number"
                  step="0.1"
                  className="input mt-1"
                  value={foodAmount}
                  onChange={(event) => setFoodAmount(event.target.value)}
                />
              </label>

              <label className="text-sm text-[#3d5f51]">
                Unit
                <select className="input mt-1" value={foodUnit} onChange={(event) => setFoodUnit(event.target.value)}>
                  {getFoodUnits(selectedFood).map((unit) => (
                    <option key={unit.label} value={unit.label}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {selectedFoodNutrition && (
            <div className="rounded-2xl border border-[#dce7dc] bg-[#f8fcf9] p-3 text-sm text-[#36584a]">
              <p>{Math.round(selectedFoodNutrition.calories)} kcal</p>
              <p>
                P {selectedFoodNutrition.protein} | C {selectedFoodNutrition.carbs} | F {selectedFoodNutrition.fat}
              </p>
            </div>
          )}

          <LoadingButton className="btn-primary w-full" onClick={saveFoodLog} loading={isActionLoading('save-food-log')}>
            {selectedLoggable?.type === 'meal' ? 'Add meal to day' : 'Add to day'}
          </LoadingButton>
        </div>
      </TopSheet>

      <BottomSheet open={customFoodSheetOpen} title="Custom Food" onClose={() => setCustomFoodSheetOpen(false)}>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Food name"
            value={customFood.name}
            onChange={(event) => setCustomFood((prev) => ({ ...prev, name: event.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            {[
              ['caloriesPer100g', 'Calories / 100g'],
              ['proteinPer100g', 'Protein / 100g'],
              ['carbsPer100g', 'Carbs / 100g'],
              ['fatPer100g', 'Fat / 100g'],
            ].map(([key, label]) => (
              <label key={key} className="text-sm text-[#3d5f51]">
                {label}
                <input
                  type="number"
                  className="input mt-1"
                  value={customFood[key]}
                  onChange={(event) => setCustomFood((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <p className="text-sm font-semibold text-[#2f5447]">Serving weights</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['tbsp', 'tbsp'],
              ['cup', 'cup'],
              ['piece', 'piece'],
            ].map(([key, label]) => (
              <label key={key} className="text-sm text-[#3d5f51]">
                {label} (g)
                <input
                  type="number"
                  className="input mt-1"
                  value={customFood[key]}
                  onChange={(event) => setCustomFood((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <LoadingButton className="btn-primary w-full" onClick={saveCustomFood} loading={isActionLoading('save-custom-food')}>
            Save food
          </LoadingButton>
        </div>
      </BottomSheet>

      <TopSheet
        open={mealSheetOpen}
        title={editingMealId ? 'Edit Meal' : 'Create Meal'}
        onClose={() => {
          setMealSheetOpen(false)
          setEditingMealId(null)
          setMealFoodQuery('')
          setMealFoodAutocompleteOpen(false)
          setMealItemBeingEdited(null)
        }}
      >
        <div className="space-y-3">
          <input className="input" placeholder="Meal name" value={mealName} onChange={(event) => setMealName(event.target.value)} />
          {mealItems.map((item, index) => {
            const itemFood = foods.find((food) => String(food.id) === item.foodId)
            const units = getFoodUnits(itemFood)
            const isEditing = mealItemBeingEdited === index
            return (
              <div key={index} className="rounded-2xl border border-[#dbe6dc] bg-white p-3">
                <div className="grid grid-cols-1 gap-2">
                  {isEditing ? (
                    <>
                      <div className="rounded-2xl border border-[#d9e7da] bg-white p-2">
                        <input
                          ref={mealSearchInputRef}
                          className="input !border-0 !bg-transparent !px-1 !py-2 !ring-0"
                          placeholder="Search food"
                          value={mealFoodQuery}
                          onFocus={() => setMealFoodAutocompleteOpen(true)}
                          onChange={(event) => {
                            setMealFoodQuery(event.target.value)
                            setMealFoodAutocompleteOpen(true)
                          }}
                        />
                      </div>
                      {mealFoodAutocompleteOpen && (
                        <div className="max-h-40 overflow-y-auto rounded-2xl border border-[#dbe7dc] bg-white p-2">
                          {mealFoodAutocompleteResults.length === 0 && <p className="px-3 py-2 text-sm text-[#5c776a]">No matching food.</p>}
                          {mealFoodAutocompleteResults.map((row) => (
                            <button
                              key={`${row.type}-${row.id}`}
                              className="mb-1 flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-[#dce8dd] hover:bg-[#eff7f0]"
                              onClick={() => {
                                const food = foods.find((f) => String(f.id) === String(row.id))
                                setMealItems((prev) =>
                                  prev.map((mItem, idx) =>
                                    idx === index ? { ...mItem, foodId: String(row.id), unit: food?.servings?.[0]?.label || 'g' } : mItem,
                                  ),
                                )
                                setMealFoodQuery('')
                                setMealFoodAutocompleteOpen(false)
                                setMealItemBeingEdited(null)
                              }}
                            >
                              <span className="text-[#1f4739]">{row.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      className="flex items-center justify-between rounded-xl border border-[#d9e7da] bg-[#f8fdf9] px-3 py-2 text-left text-sm font-semibold text-[#1f4739]"
                      onClick={() => {
                        setMealItemBeingEdited(index)
                        setMealFoodQuery(itemFood?.name || '')
                        setMealFoodAutocompleteOpen(false)
                        setTimeout(() => {
                          if (mealSearchInputRef.current) {
                            mealSearchInputRef.current.focus()
                          }
                        }, 50)
                      }}
                    >
                      <span>{itemFood?.name || 'Choose food'}</span>
                      <span className="text-xs text-[#5a8f81]">({item.amount} {item.unit})</span>
                    </button>
                  )}
                  {!isEditing && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        className="input"
                        value={item.amount}
                        onChange={(event) =>
                          setMealItems((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, amount: event.target.value } : row)))
                        }
                      />
                      <select
                        className="input"
                        value={item.unit}
                        onChange={(event) =>
                          setMealItems((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, unit: event.target.value } : row)))
                        }
                      >
                        {units.map((unit) => (
                          <option key={unit.label} value={unit.label}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {mealItems.length > 1 && (
                  <button
                    className="mt-2 text-sm font-semibold text-[#2e5a49]"
                    onClick={() => setMealItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    Remove item
                  </button>
                )}
              </div>
            )
          })}
          <button className="btn-muted w-full" onClick={() => setMealItems((prev) => [...prev, createEmptyMealItem()])}>
            Add another food
          </button>
          <LoadingButton className="btn-primary w-full" onClick={saveMeal} loading={isActionLoading('save-meal')}>
            {editingMealId ? 'Save meal changes' : 'Save meal'}
          </LoadingButton>
        </div>
      </TopSheet>

      <BottomSheet open={aiSheetOpen} title="AI Food Estimate" onClose={() => setAiSheetOpen(false)}>
        <div className="space-y-3">
          <label className="btn-muted w-full cursor-pointer text-center">
            Pick Photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onAiFileChange} />
          </label>
          {aiDataUrl && <img src={aiDataUrl} className="max-h-44 w-full rounded-2xl object-cover" alt="Meal preview" />}
          <LoadingButton className="btn-primary w-full" onClick={runAiEstimate} loading={aiLoading} disabled={!aiDataUrl}>
            {aiLoading ? 'Estimating...' : 'Estimate macros'}
          </LoadingButton>

          <label className="text-sm text-[#3d5f51]">
            Description
            <input
              className="input mt-1"
              value={aiEstimate.description}
              onChange={(event) => setAiEstimate((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['calories', 'Calories'],
              ['protein', 'Protein'],
              ['carbs', 'Carbs'],
              ['fat', 'Fat'],
            ].map(([key, label]) => (
              <label key={key} className="text-sm text-[#3d5f51]">
                {label}
                <input
                  type="number"
                  className="input mt-1"
                  value={aiEstimate[key]}
                  onChange={(event) => setAiEstimate((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <LoadingButton className="btn-primary w-full" onClick={addAiEstimateToLog} loading={isActionLoading('save-ai-entry')}>
            Add estimate to day
          </LoadingButton>
        </div>
      </BottomSheet>

      <BottomSheet open={exerciseSheetOpen} title={editingExercise ? 'Edit Exercise' : 'Add Exercise'} onClose={() => setExerciseSheetOpen(false)}>
        <div className="space-y-3">
          <label className="text-sm text-[#3d5f51]">
            Exercise type
            <select
              className="input mt-1"
              value={exerciseForm.type}
              onChange={(event) => setExerciseForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="walking">Walking</option>
              <option value="jogging">Jogging</option>
              <option value="cycling">Cycling</option>
              <option value="weights">Gym Weights</option>
              <option value="hiit">HIIT</option>
            </select>
          </label>

          <label className="text-sm text-[#3d5f51]">
            Minutes
            <input
              type="number"
              className="input mt-1"
              value={exerciseForm.minutes}
              onChange={(event) => setExerciseForm((prev) => ({ ...prev, minutes: event.target.value }))}
            />
          </label>

          <label className="text-sm text-[#3d5f51]">
            Calories burned (optional override)
            <input
              type="number"
              className="input mt-1"
              placeholder={estimatedExerciseBurn ? `Estimated: ${estimatedExerciseBurn}` : 'Calculated from profile'}
              value={exerciseForm.caloriesBurned}
              onChange={(event) => setExerciseForm((prev) => ({ ...prev, caloriesBurned: event.target.value }))}
            />
          </label>

          <label className="text-sm text-[#3d5f51]">
            Notes (optional)
            <input
              className="input mt-1"
              value={exerciseForm.notes}
              onChange={(event) => setExerciseForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>

          <div className="rounded-2xl bg-[#f4faf6] p-3 text-sm text-[#36584a]">
            Estimated burn: {estimatedExerciseBurn || 0} kcal
          </div>

          <LoadingButton className="btn-primary w-full" onClick={saveExercise} loading={isActionLoading('save-exercise')}>
            {editingExercise ? 'Save exercise changes' : 'Add exercise'}
          </LoadingButton>
        </div>
      </BottomSheet>

      <BottomSheet open={editSheetOpen} title="Edit Entry" onClose={() => setEditSheetOpen(false)}>
        {editingLog && (
          <div className="space-y-3">
            <input
              className="input"
              value={editingLog.description || ''}
              onChange={(event) => setEditingLog((prev) => ({ ...prev, description: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              {[
                ['calories', 'Calories'],
                ['protein', 'Protein'],
                ['carbs', 'Carbs'],
                ['fat', 'Fat'],
              ].map(([key, label]) => (
                <label key={key} className="text-sm text-[#3d5f51]">
                  {label}
                  <input
                    type="number"
                    className="input mt-1"
                    value={editingLog[key]}
                    onChange={(event) => setEditingLog((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
            <LoadingButton className="btn-primary w-full" onClick={saveEditedLog} loading={isActionLoading('save-edited-log')}>
              Save changes
            </LoadingButton>
          </div>
        )}
      </BottomSheet>
    </main>
  )
}

export default App
