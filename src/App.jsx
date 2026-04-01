import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FaCamera,
  FaChartPie,
  FaGear,
  FaHouse,
  FaListCheck,
  FaPen,
  FaPlus,
  FaTrash,
  FaXmark,
} from 'react-icons/fa6'
import {
  adjustDateByDays,
  db,
  ensureSeedData,
  exportAllData,
  getAllMeals,
  getExercisesBetweenDates,
  getExercisesForDate,
  getLogsBetweenDates,
  getLogsForDate,
  getRecentLogEntries,
  getSettings,
  normalizeText,
  restoreAllData,
  saveSettings,
  toDateKey,
} from './db'
import { estimateNutritionFromImage } from './services/ai'

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
    calories: Number((food.caloriesPer100g * factor).toFixed(1)),
    protein: Number((food.proteinPer100g * factor).toFixed(1)),
    carbs: Number((food.carbsPer100g * factor).toFixed(1)),
    fat: Number((food.fatPer100g * factor).toFixed(1)),
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

function BottomSheet({ open, title, onClose, children }) {
  if (!open) return null

  return (
    <>
      <button className="sheet-overlay" onClick={onClose} aria-label="Close"></button>
      <section className="sheet-panel">
        <div className="mb-3 flex items-center justify-between border-b border-[#dfe7de] pb-3">
          <h3 className="font-['Sora'] text-lg font-semibold text-[#163d31]">{title}</h3>
          <button className="btn-muted !rounded-full !p-2" onClick={onClose}>
            <FaXmark />
          </button>
        </div>
        {children}
      </section>
    </>
  )
}

function ProgressRing({ consumed, goal }) {
  const safeGoal = goal || 1
  const progress = Math.min(consumed / safeGoal, 1)
  const radius = 52
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative grid h-36 w-36 place-items-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} stroke="#deebdf" strokeWidth="14" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="#1ea96d"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs uppercase tracking-wide text-[#4a6658]">Calories</p>
        <p className="font-['Sora'] text-2xl font-bold text-[#163d31]">{Math.round(consumed)}</p>
      </div>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [logs, setLogs] = useState([])
  const [exercises, setExercises] = useState([])
  const [dailyHistory, setDailyHistory] = useState([])
  const [foods, setFoods] = useState([])
  const [meals, setMeals] = useState([])
  const [settings, setSettings] = useState(null)

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
  const [touchStartX, setTouchStartX] = useState(0)

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

  const loadFoods = useCallback(async () => {
    const allFoods = await db.foods.orderBy('name').toArray()
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
    setRecentLogEntries(await getRecentLogEntries(8))
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
      loadDailyHistory(today, calculateRestCalories(savedSettings)),
    ])
  }, [loadDailyHistory, loadDateExercises, loadDateLogs, loadFoods, loadRecentEntries])

  useEffect(() => {
    bootstrap().catch((error) => {
      alert(error.message)
    })
  }, [bootstrap])

  useEffect(() => {
    Promise.all([loadDateLogs(dateKey), loadDateExercises(dateKey)]).catch((error) => alert(error.message))
  }, [dateKey, loadDateExercises, loadDateLogs])

  useEffect(() => {
    if (!settings) return
    loadDailyHistory(selectedDate, calculateRestCalories(settings)).catch((error) => alert(error.message))
  }, [loadDailyHistory, selectedDate, settings])

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
      await db.logs.add({
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
  }

  const saveCustomFood = async () => {
    if (!customFood.name.trim()) return

    const servings = [
      { label: 'g', grams: 1 },
      { label: 'tbsp', grams: Number(customFood.tbsp) || 0 },
      { label: 'cup', grams: Number(customFood.cup) || 0 },
      { label: 'piece', grams: Number(customFood.piece) || 0 },
    ].filter((row) => row.grams > 0)

    await db.foods.add({
      name: customFood.name.trim(),
      searchName: normalizeText(customFood.name),
      source: 'custom',
      caloriesPer100g: Number(customFood.caloriesPer100g) || 0,
      proteinPer100g: Number(customFood.proteinPer100g) || 0,
      carbsPer100g: Number(customFood.carbsPer100g) || 0,
      fatPer100g: Number(customFood.fatPer100g) || 0,
      servings,
      createdAt: Date.now(),
    })

    setCustomFood(defaultCustomFood)
    setCustomFoodSheetOpen(false)
    await loadFoods()
  }

  const saveMeal = async () => {
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
      await db.meals.update(editingMealId, {
        name: mealName.trim(),
        searchName: normalizeText(mealName),
        items: itemRows,
        totals: totalsRow,
      })
    } else {
      await db.meals.add({
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
  }

  const openCreateMeal = () => {
    setEditingMealId(null)
    setMealName('')
    setMealItems([createEmptyMealItem()])
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
    await db.meals.delete(mealId)
    setMeals(await getAllMeals())
  }

  const logMeal = async (meal) => {
    await db.logs.add({
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
  }

  const deleteLog = async (id) => {
    await db.logs.delete(id)
    await Promise.all([loadDateLogs(dateKey), loadRecentEntries(), loadDailyHistory(selectedDate, restingCalories)])
  }

  const saveEditedLog = async () => {
    if (!editingLog) return

    await db.logs.update(editingLog.id, {
      description: editingLog.description,
      calories: Number(editingLog.calories) || 0,
      protein: Number(editingLog.protein) || 0,
      carbs: Number(editingLog.carbs) || 0,
      fat: Number(editingLog.fat) || 0,
    })

    setEditSheetOpen(false)
    setEditingLog(null)
    await Promise.all([loadDateLogs(dateKey), loadRecentEntries(), loadDailyHistory(selectedDate, restingCalories)])
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
      await db.exercises.update(editingExercise.id, payload)
    } else {
      await db.exercises.add(payload)
    }

    setExerciseSheetOpen(false)
    setEditingExercise(null)
    setExerciseForm({ type: 'walking', minutes: 30, caloriesBurned: '', notes: '' })

    await Promise.all([
      loadDateExercises(dateKey),
      loadDailyHistory(selectedDate, restingCalories),
    ])
  }

  const deleteExercise = async (id) => {
    await db.exercises.delete(id)
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
    await db.logs.add({
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
  }

  const saveGoals = async () => {
    await saveSettings(settings)
    alert('Settings saved on this device.')
  }

  const downloadBackup = async () => {
    const backup = await exportAllData()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `calories-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
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

  const onTouchStart = (event) => setTouchStartX(event.touches[0]?.clientX || 0)
  const onTouchEnd = (event) => {
    const endX = event.changedTouches[0]?.clientX || 0
    const delta = endX - touchStartX
    if (Math.abs(delta) < 50) return

    setSelectedDate((prev) => adjustDateByDays(prev, delta > 0 ? -1 : 1))
  }

  if (!settings) {
    return <main className="grid min-h-screen place-items-center">Loading...</main>
  }

  return (
    <main className="phone-shell pb-24">
      <header className="px-4 pb-3 pt-5">
        <h1 className="font-['Sora'] text-2xl font-bold text-[#163d31]">Calories Coach</h1>
        <p className="text-sm text-[#4c695b]">Offline-first nutrition tracking for your phone.</p>
      </header>

      <section className="px-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="card flex items-center justify-between">
              <button className="btn-muted" onClick={() => setSelectedDate((prev) => adjustDateByDays(prev, -1))}>
                Previous
              </button>
              <div className="text-center">
                <p className="font-['Sora'] text-base font-semibold text-[#184034]">{formatDisplayDate(selectedDate)}</p>
                <input
                  type="date"
                  className="input mt-1 !w-[150px]"
                  value={dateKey}
                  onChange={(event) => setSelectedDate(new Date(`${event.target.value}T12:00:00`))}
                />
              </div>
              <button className="btn-muted" onClick={() => setSelectedDate((prev) => adjustDateByDays(prev, 1))}>
                Next
              </button>
            </div>

            <div className="card flex items-center justify-between">
              <div>
                <p className="text-sm text-[#4a6658]">Goal</p>
                <p className="font-['Sora'] text-xl font-bold text-[#163d31]">{settings.calorieGoal} kcal</p>
                <p className="text-xs text-[#4a6658]">Swipe left or right to move between days</p>
              </div>
              <ProgressRing consumed={totals.calories} goal={settings.calorieGoal} />
            </div>

            <div className="card grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f4faf6] p-3">
                <p className="text-xs uppercase tracking-wide text-[#5a7769]">BMI</p>
                <p className="font-['Sora'] text-xl font-bold text-[#194436]">{bmi || '-'}</p>
              </div>
              <div className="rounded-2xl bg-[#f4faf6] p-3">
                <p className="text-xs uppercase tracking-wide text-[#5a7769]">Rest Burn</p>
                <p className="font-['Sora'] text-xl font-bold text-[#194436]">{restingCalories ? `${restingCalories} kcal` : '-'}</p>
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-base font-semibold text-[#1c4437]">Daily Energy Balance</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-[#f4faf6] p-3">
                  <p className="text-[#5a7769]">Consumed</p>
                  <p className="font-semibold text-[#22493d]">{Math.round(totals.calories)} kcal</p>
                </div>
                <div className="rounded-2xl bg-[#f4faf6] p-3">
                  <p className="text-[#5a7769]">Burned (Rest + Exercise)</p>
                  <p className="font-semibold text-[#22493d]">{Math.round(totalBurn)} kcal</p>
                </div>
              </div>
              <div
                className={`rounded-2xl border p-3 text-sm font-semibold ${
                  calorieBalance >= 0 ? 'border-[#bde7ce] bg-[#ecfbf2] text-[#1f6f4b]' : 'border-[#f3d0cd] bg-[#fff1ef] text-[#9f3c33]'
                }`}
              >
                {calorieBalance >= 0
                  ? `Deficit ${Math.round(calorieBalance)} kcal (burned more than consumed)`
                  : `Surplus ${Math.abs(Math.round(calorieBalance))} kcal (consumed more than burned)`}
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-base font-semibold text-[#1c4437]">Weight Trajectory</h2>
              {projectionScenarios.length === 0 && (
                <p className="text-sm text-[#577064]">Add weight, height and age in settings to calculate projections.</p>
              )}
              {projectionScenarios.map((scenario) => (
                <div key={scenario.intake} className="rounded-2xl border border-[#dde6dc] bg-[#fbfdf9] p-3 text-sm text-[#36584a]">
                  <p className="font-semibold text-[#1f4739]">At {scenario.intake} kcal/day</p>
                  <p className="text-xs text-[#5b7569]">Daily balance: {scenario.deltaPerDay >= 0 ? '+' : ''}{Math.round(scenario.deltaPerDay)} kcal</p>
                  <p>30 days: {scenario.in30} kg</p>
                  <p>90 days: {scenario.in90} kg</p>
                </div>
              ))}
            </div>

            <div className="card">
              <h2 className="mb-3 font-['Sora'] text-base font-semibold text-[#1c4437]">Last 10 Days</h2>
              <div className="space-y-2">
                {dailyHistory.map((day) => (
                  <div key={day.dateKey} className="flex items-center justify-between rounded-2xl bg-[#f7fbf6] p-2 text-sm">
                    <span className="font-semibold text-[#2b5444]">{day.dateKey}</span>
                    <span className="text-[#45685a]">{Math.round(day.consumed)} / {Math.round(day.burned)} kcal</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${day.balance >= 0 ? 'bg-[#dcf6e7] text-[#1e6d49]' : 'bg-[#ffe1dd] text-[#994238]'}`}>
                      {day.balance >= 0 ? `-${Math.round(day.balance)}` : `+${Math.abs(Math.round(day.balance))}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              {[
                { key: 'protein', label: 'Protein', total: totals.protein, goal: settings.proteinGoal },
                { key: 'carbs', label: 'Carbs', total: totals.carbs, goal: settings.carbsGoal },
                { key: 'fat', label: 'Fat', total: totals.fat, goal: settings.fatGoal },
              ].map((macro) => {
                const progress = Math.min((macro.total || 0) / (macro.goal || 1), 1)
                return (
                  <div key={macro.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <p className="font-semibold text-[#224a3d]">{macro.label}</p>
                      <p className="text-[#446253]">
                        {macro.total.toFixed(1)}g / {macro.goal}g
                      </p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#dce8dd]">
                      <div className={`h-full rounded-full ${macroColors[macro.key]}`} style={{ width: `${progress * 100}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-['Sora'] text-base font-semibold text-[#1c4437]">Exercise</h2>
                <button className="btn-primary" onClick={openExerciseCreate}>
                  <FaPlus className="mr-2" /> Add Exercise
                </button>
              </div>
              {exercises.length === 0 && <p className="text-sm text-[#577064]">No exercise entries for this day.</p>}
              <div className="space-y-2">
                {exercises.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-[#dde6dc] bg-[#fbfdf9] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#21453a]">{entry.description || entry.type}</p>
                        <p className="text-xs text-[#5b7569]">{entry.minutes} min • {Math.round(entry.caloriesBurned)} kcal burned</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-muted !rounded-full !p-2" onClick={() => openExerciseEdit(entry)} aria-label="Edit exercise">
                          <FaPen />
                        </button>
                        <button className="btn-muted !rounded-full !p-2" onClick={() => deleteExercise(entry.id)} aria-label="Delete exercise">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    {entry.notes && <p className="mt-2 text-sm text-[#355648]">{entry.notes}</p>}
                  </article>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="mb-3 font-['Sora'] text-base font-semibold text-[#1c4437]">Daily Timeline</h2>
              <div className="space-y-2">
                {logs.length === 0 && <p className="text-sm text-[#577064]">No entries for this day yet.</p>}
                {logs.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-[#dde6dc] bg-[#fbfdf9] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-left">
                        <p className="font-semibold text-[#21453a]">{entry.description || 'Entry'}</p>
                        <p className="text-xs text-[#5b7569]">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn-muted !rounded-full !p-2"
                          onClick={() => {
                            setEditingLog(entry)
                            setEditSheetOpen(true)
                          }}
                          aria-label="Edit entry"
                        >
                          <FaPen />
                        </button>
                        <button className="btn-muted !rounded-full !p-2" onClick={() => deleteLog(entry.id)} aria-label="Delete entry">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-[#355648]">
                      {Math.round(entry.calories)} kcal | P {entry.protein} | C {entry.carbs} | F {entry.fat}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Log Food</h2>
              <button
                className="btn-primary w-full"
                onClick={() => {
                  setFoodSheetOpen(true)
                  setIsAutocompleteOpen(true)
                }}
              >
                Search foods and meals
              </button>
              <button className="btn-muted w-full" onClick={() => setCustomFoodSheetOpen(true)}>
                Add custom food
              </button>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Latest Added</h2>
              {recentLogEntries.length === 0 && <p className="text-sm text-[#5b7569]">Your recent foods and meals will appear here.</p>}
              <div className="flex flex-wrap gap-2">
                {recentLogEntries.map((entry) => (
                  <button
                    key={entry.key}
                    className="btn-muted !rounded-full !px-3 !py-2 text-xs"
                    onClick={() => quickAddRecent(entry)}
                  >
                    {entry.type === 'meal' ? 'Meal: ' : ''}
                    {entry.label}
                    {entry.type === 'food' ? ` (${entry.amount} ${entry.unit})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Calculate from Picture</h2>
              <p className="text-sm text-[#5b7569]">Take or upload a food photo, estimate macros, then edit before logging.</p>
              <button className="btn-primary w-full" onClick={() => setAiSheetOpen(true)}>
                <FaCamera className="mr-2" /> Open AI Estimator
              </button>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Log Exercise</h2>
              <p className="text-sm text-[#5b7569]">Track activity minutes and add calories burned to your day.</p>
              <button className="btn-primary w-full" onClick={openExerciseCreate}>
                <FaPlus className="mr-2" /> Add Exercise
              </button>
            </div>
          </div>
        )}

        {activeTab === 'meals' && (
          <div className="space-y-4">
            <div className="card flex items-center justify-between">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Saved Meals</h2>
              <button className="btn-primary" onClick={openCreateMeal}>
                <FaPlus className="mr-2" /> New Meal
              </button>
            </div>

            {meals.length === 0 && <div className="card text-sm text-[#5b7569]">No meals yet. Build your first combo.</div>}

            {meals.map((meal) => (
              <div key={meal.id} className="card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-['Sora'] text-base font-semibold text-[#204638]">{meal.name}</p>
                    <p className="text-sm text-[#5d766a]">
                      {Math.round(meal.totals?.calories || 0)} kcal | P {Number(meal.totals?.protein || 0).toFixed(1)} | C{' '}
                      {Number(meal.totals?.carbs || 0).toFixed(1)} | F {Number(meal.totals?.fat || 0).toFixed(1)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn-muted" onClick={() => openEditMeal(meal)}>
                      <FaPen className="mr-2" /> Edit
                    </button>
                    <button className="btn-muted" onClick={() => deleteMeal(meal.id)}>
                      <FaTrash className="mr-2" /> Delete
                    </button>
                    <button className="btn-primary" onClick={() => logMeal(meal)}>
                      Log
                    </button>
                  </div>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#4b6458]">
                  {meal.items?.map((item, index) => (
                    <li key={`${meal.id}-${index}`}>
                      {item.foodName}: {item.amount} {item.unit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Daily Goals</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['calorieGoal', 'Calories'],
                  ['proteinGoal', 'Protein'],
                  ['carbsGoal', 'Carbs'],
                  ['fatGoal', 'Fat'],
                ].map(([key, label]) => (
                  <label key={key} className="text-sm text-[#3d5f51]">
                    {label}
                    <input
                      type="number"
                      className="input mt-1"
                      value={settings[key]}
                      onChange={(event) => setSettings((prev) => ({ ...prev, [key]: Number(event.target.value) || 0 }))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Body Metrics (Optional)</h2>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm text-[#3d5f51]">
                  Weight (kg)
                  <input
                    type="number"
                    step="0.1"
                    className="input mt-1"
                    value={settings.weightKg}
                    onChange={(event) => setSettings((prev) => ({ ...prev, weightKg: Number(event.target.value) || 0 }))}
                  />
                </label>
                <label className="text-sm text-[#3d5f51]">
                  Height (cm)
                  <input
                    type="number"
                    className="input mt-1"
                    value={settings.heightCm}
                    onChange={(event) => setSettings((prev) => ({ ...prev, heightCm: Number(event.target.value) || 0 }))}
                  />
                </label>
                <label className="text-sm text-[#3d5f51]">
                  Age
                  <input
                    type="number"
                    className="input mt-1"
                    value={settings.ageYears}
                    onChange={(event) => setSettings((prev) => ({ ...prev, ageYears: Number(event.target.value) || 0 }))}
                  />
                </label>
                <label className="text-sm text-[#3d5f51]">
                  Sex
                  <select className="input mt-1" value={settings.sex} onChange={(event) => setSettings((prev) => ({ ...prev, sex: event.target.value }))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-[#f4faf6] p-3 text-sm text-[#36584a]">
                <p>BMI: {bmi || '-'}</p>
                <p>Resting calories/day: {restingCalories || '-'}</p>
              </div>
              <label className="text-sm text-[#3d5f51]">
                Projection intake (kcal/day)
                <input
                  type="number"
                  className="input mt-1"
                  value={settings.projectionIntakeCalories}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, projectionIntakeCalories: Number(event.target.value) || 0 }))
                  }
                />
              </label>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">AI Provider</h2>
              <select
                className="input"
                value={settings.aiProvider}
                onChange={(event) => setSettings((prev) => ({ ...prev, aiProvider: event.target.value }))}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>

              <label className="text-sm text-[#3d5f51]">
                OpenAI API key
                <input
                  type="password"
                  className="input mt-1"
                  value={settings.openAiApiKey}
                  onChange={(event) => setSettings((prev) => ({ ...prev, openAiApiKey: event.target.value.trim() }))}
                />
              </label>

              <label className="text-sm text-[#3d5f51]">
                OpenAI model
                <input
                  className="input mt-1"
                  value={settings.openAiModel}
                  onChange={(event) => setSettings((prev) => ({ ...prev, openAiModel: event.target.value.trim() }))}
                />
              </label>

              <label className="text-sm text-[#3d5f51]">
                Gemini API key
                <input
                  type="password"
                  className="input mt-1"
                  value={settings.geminiApiKey}
                  onChange={(event) => setSettings((prev) => ({ ...prev, geminiApiKey: event.target.value.trim() }))}
                />
              </label>

              <label className="text-sm text-[#3d5f51]">
                Gemini model
                <input
                  className="input mt-1"
                  value={settings.geminiModel}
                  onChange={(event) => setSettings((prev) => ({ ...prev, geminiModel: event.target.value.trim() }))}
                />
              </label>

              <button className="btn-primary w-full" onClick={saveGoals}>
                Save settings
              </button>
            </div>

            <div className="card space-y-3">
              <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Backup & Restore</h2>
              <button className="btn-primary w-full" onClick={downloadBackup}>
                Export data JSON
              </button>
              <label className="btn-muted w-full cursor-pointer text-center">
                Import backup JSON
                <input type="file" accept="application/json" className="hidden" onChange={restoreBackup} />
              </label>
            </div>
          </div>
        )}
      </section>

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

      <BottomSheet open={foodSheetOpen} title="Log Food" onClose={() => setFoodSheetOpen(false)}>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Type a food or meal"
            value={logQuery}
            onFocus={() => setIsAutocompleteOpen(true)}
            onChange={(event) => {
              setLogQuery(event.target.value)
              setSelectedLoggable(null)
              setIsAutocompleteOpen(true)
            }}
          />

          {isAutocompleteOpen && (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-[#dbe7dc] bg-white p-1">
              {autocompleteResults.length === 0 && <p className="px-3 py-2 text-sm text-[#5c776a]">No matching food or meal.</p>}
              {autocompleteResults.map((row) => (
                <button
                  key={`${row.type}-${row.id}`}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-[#edf6ee]"
                  onClick={() => selectAutocompleteResult(row)}
                >
                  <span className="text-[#1f4739]">{row.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
            <div className="grid grid-cols-2 gap-2">
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

          <button className="btn-primary w-full" onClick={saveFoodLog}>
            {selectedLoggable?.type === 'meal' ? 'Add meal to day' : 'Add to day'}
          </button>
        </div>
      </BottomSheet>

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
          <button className="btn-primary w-full" onClick={saveCustomFood}>
            Save food
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={mealSheetOpen}
        title={editingMealId ? 'Edit Meal' : 'Create Meal'}
        onClose={() => {
          setMealSheetOpen(false)
          setEditingMealId(null)
        }}
      >
        <div className="space-y-3">
          <input className="input" placeholder="Meal name" value={mealName} onChange={(event) => setMealName(event.target.value)} />
          {mealItems.map((item, index) => {
            const itemFood = foods.find((food) => String(food.id) === item.foodId)
            const units = getFoodUnits(itemFood)
            return (
              <div key={index} className="rounded-2xl border border-[#dbe6dc] bg-white p-3">
                <div className="grid grid-cols-1 gap-2">
                  <select
                    className="input"
                    value={item.foodId}
                    onChange={(event) => {
                      const food = foods.find((row) => String(row.id) === event.target.value)
                      setMealItems((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, foodId: event.target.value, unit: food?.servings?.[0]?.label || 'g' } : row,
                        ),
                      )
                    }}
                  >
                    <option value="">Choose food</option>
                    {foods.map((food) => (
                      <option key={food.id} value={food.id}>
                        {food.name}
                      </option>
                    ))}
                  </select>
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
          <button className="btn-primary w-full" onClick={saveMeal}>
            {editingMealId ? 'Save meal changes' : 'Save meal'}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={aiSheetOpen} title="AI Food Estimate" onClose={() => setAiSheetOpen(false)}>
        <div className="space-y-3">
          <label className="btn-muted w-full cursor-pointer text-center">
            Pick Photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onAiFileChange} />
          </label>
          {aiDataUrl && <img src={aiDataUrl} className="max-h-44 w-full rounded-2xl object-cover" alt="Meal preview" />}
          <button className="btn-primary w-full" onClick={runAiEstimate} disabled={aiLoading || !aiDataUrl}>
            {aiLoading ? 'Estimating...' : 'Estimate macros'}
          </button>

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
          <button className="btn-primary w-full" onClick={addAiEstimateToLog}>
            Add estimate to day
          </button>
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

          <button className="btn-primary w-full" onClick={saveExercise}>
            {editingExercise ? 'Save exercise changes' : 'Add exercise'}
          </button>
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
            <button className="btn-primary w-full" onClick={saveEditedLog}>
              Save changes
            </button>
          </div>
        )}
      </BottomSheet>
    </main>
  )
}

export default App
