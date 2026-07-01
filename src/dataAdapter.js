/**
 * Data Adapter — routes all CRUD operations to either Dexie (offline/local)
 * or Firestore (cloud with offline persistence) depending on auth state.
 *
 * When a user is signed in, Firestore's persistentLocalCache provides offline
 * capability that replaces Dexie. When signed out, Dexie is used as before.
 */
import { isFirestoreMode, getCurrentUserId, setCurrentUser } from "./firestoreDb";
import dexieDb from "./dexieDb";
import {
  getAllFoods as fsGetAllFoods,
  searchFoods as fsSearchFoods,
  addFood as fsAddFood,
  bulkPutFoods as fsBulkPutFoods,
  getAllMeals as fsGetAllMeals,
  addMeal as fsAddMeal,
  updateMeal as fsUpdateMeal,
  deleteMeal as fsDeleteMeal,
  addLog as fsAddLog,
  getLogsForDate as fsGetLogsForDate,
  getLogsBetweenDates as fsGetLogsBetweenDates,
  updateLog as fsUpdateLog,
  deleteLog as fsDeleteLog,
  getRecentLogEntries as fsGetRecentLogEntries,
  addExercise as fsAddExercise,
  updateExercise as fsUpdateExercise,
  deleteExercise as fsDeleteExercise,
  getExercisesForDate as fsGetExercisesForDate,
  getExercisesBetweenDates as fsGetExercisesBetweenDates,
  getSettingsDoc as fsGetSettings,
  saveSettingsBulk as fsSaveSettings,
  getMeta as fsGetMeta,
  putMeta as fsPutMeta,
  exportAllData as fsExportAllData,
  restoreAllData as fsRestoreAllData,
} from "./firestoreDb";

// ─── Utility ────────────────────────────────────────────────────────────────

const uid = () => getCurrentUserId();

// ─── Foods ──────────────────────────────────────────────────────────────────

export const searchFoods = async (query, resultLimit = 20) => {
  if (isFirestoreMode()) return fsSearchFoods(uid(), query, resultLimit);
  return dexieDb.foods
    .filter((food) => !query || food.searchName?.includes(query.toLowerCase().trim()))
    .limit(resultLimit)
    .toArray();
};

export const getAllFoods = async () => {
  if (isFirestoreMode()) return fsGetAllFoods(uid());
  return dexieDb.foods.orderBy("name").toArray();
};

export const addFood = async (food) => {
  if (isFirestoreMode()) return fsAddFood(uid(), food);
  return dexieDb.foods.add(food);
};

export const bulkPutFoods = async (foods) => {
  if (isFirestoreMode()) return fsBulkPutFoods(uid(), foods);
  // Use Dexie's built-in bulkPut which does upsert
  return dexieDb.foods.bulkPut(foods);
};

// ─── Meals ──────────────────────────────────────────────────────────────────

export const getAllMeals = async () => {
  if (isFirestoreMode()) return fsGetAllMeals(uid());
  return dexieDb.meals.orderBy("name").toArray();
};

export const addMeal = async (meal) => {
  if (isFirestoreMode()) return fsAddMeal(uid(), meal);
  return dexieDb.meals.add(meal);
};

export const updateMeal = async (mealId, data) => {
  if (isFirestoreMode()) return fsUpdateMeal(uid(), mealId, data);
  return dexieDb.meals.update(mealId, data);
};

export const deleteMeal = async (mealId) => {
  if (isFirestoreMode()) return fsDeleteMeal(uid(), mealId);
  return dexieDb.meals.delete(mealId);
};

// ─── Logs ───────────────────────────────────────────────────────────────────

export const addLog = async (logEntry) => {
  if (isFirestoreMode()) return fsAddLog(uid(), logEntry);
  return dexieDb.logs.add(logEntry);
};

export const getLogsForDate = async (dateKey) => {
  if (isFirestoreMode()) return fsGetLogsForDate(uid(), dateKey);
  return dexieDb.logs.where("dateKey").equals(dateKey).toArray();
};

export const getLogsBetweenDates = async (startDateKey, endDateKey) => {
  if (isFirestoreMode())
    return fsGetLogsBetweenDates(uid(), startDateKey, endDateKey);
  return dexieDb.logs.where("dateKey").between(startDateKey, endDateKey, true, true).toArray();
};

export const updateLog = async (logId, data) => {
  if (isFirestoreMode()) return fsUpdateLog(uid(), logId, data);
  return dexieDb.logs.update(logId, data);
};

export const deleteLog = async (logId) => {
  if (isFirestoreMode()) return fsDeleteLog(uid(), logId);
  return dexieDb.logs.delete(logId);
};

export const getRecentLogEntries = async (resultLimit = 8) => {
  if (isFirestoreMode()) return fsGetRecentLogEntries(uid(), resultLimit);
  const rows = await dexieDb.logs.orderBy("timestamp").reverse().limit(resultLimit * 8).toArray();
  const result = [];
  const seen = new Set();

  for (const row of rows) {
    if (row.type === "food" && row.foodId) {
      const key = `food:${row.foodId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        key,
        type: "food",
        foodId: row.foodId,
        label: row.foodName || row.description || "Food",
        amount: Number(row.amount) || 1,
        unit: row.unit || "g",
      });
    }

    if (row.type === "meal" && row.mealId) {
      const key = `meal:${row.mealId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        key,
        type: "meal",
        mealId: row.mealId,
        label: row.mealName || row.description || "Meal",
      });
    }

    if (result.length >= resultLimit) break;
  }

  return result;
};

// ─── Exercises ──────────────────────────────────────────────────────────────

export const addExercise = async (exercise) => {
  if (isFirestoreMode()) return fsAddExercise(uid(), exercise);
  return dexieDb.exercises.add(exercise);
};

export const updateExercise = async (exerciseId, data) => {
  if (isFirestoreMode()) return fsUpdateExercise(uid(), exerciseId, data);
  return dexieDb.exercises.update(exerciseId, data);
};

export const deleteExercise = async (exerciseId) => {
  if (isFirestoreMode()) return fsDeleteExercise(uid(), exerciseId);
  return dexieDb.exercises.delete(exerciseId);
};

export const getExercisesForDate = async (dateKey) => {
  if (isFirestoreMode()) return fsGetExercisesForDate(uid(), dateKey);
  return dexieDb.exercises.where("dateKey").equals(dateKey).toArray();
};

export const getExercisesBetweenDates = async (startDateKey, endDateKey) => {
  if (isFirestoreMode())
    return fsGetExercisesBetweenDates(uid(), startDateKey, endDateKey);
  return dexieDb.exercises
    .where("dateKey")
    .between(startDateKey, endDateKey, true, true)
    .toArray();
};

// ─── Settings ───────────────────────────────────────────────────────────────

const defaultSettings = {
  calorieGoal: 2200,
  proteinGoal: 140,
  carbsGoal: 220,
  fatGoal: 70,
  weightKg: 0,
  heightCm: 0,
  ageYears: 0,
  sex: "male",
  projectionIntakeCalories: 2200,
  aiProvider: "openai",
  openAiModel: "gpt-4o-mini",
  geminiModel: "gemini-1.5-flash",
  openAiApiKey: "",
  geminiApiKey: "",
};

export const getSettings = async () => {
  if (isFirestoreMode()) {
    const data = await fsGetSettings(uid());
    return { ...defaultSettings, ...(data || {}) };
  }
  const rows = await dexieDb.settings.toArray();
  const mapped = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  return { ...defaultSettings, ...mapped };
};

export const saveSettings = async (nextSettings) => {
  if (isFirestoreMode()) {
    const entries = Object.entries(nextSettings).map(([key, value]) => ({ key, value }));
    return fsSaveSettings(uid(), entries);
  }
  const updates = Object.entries(nextSettings).map(([key, value]) => ({ key, value }));
  return dexieDb.settings.bulkPut(updates);
};

// ─── Meta ───────────────────────────────────────────────────────────────────

export const getMeta = async (key) => {
  if (isFirestoreMode()) return fsGetMeta(uid(), key);
  return dexieDb.meta.get(key);
};

export const putMeta = async (entry) => {
  if (isFirestoreMode()) return fsPutMeta(uid(), entry);
  return dexieDb.meta.put(entry);
};

// ─── Export / Restore ───────────────────────────────────────────────────────

export const exportAllData = async () => {
  if (isFirestoreMode()) return fsExportAllData(uid());
  const [foods, meals, logs, exercises, settings, meta] = await Promise.all([
    dexieDb.foods.toArray(),
    dexieDb.meals.toArray(),
    dexieDb.logs.toArray(),
    dexieDb.exercises.toArray(),
    dexieDb.settings.toArray(),
    dexieDb.meta.toArray(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    app: "Calories Coach",
    version: 1,
    data: { foods, meals, logs, exercises, settings, meta },
  };
};

export const restoreAllData = async (backup) => {
  if (!backup?.data) throw new Error("Invalid backup file format.");

  if (isFirestoreMode()) return fsRestoreAllData(uid(), backup);

  const { foods = [], meals = [], logs = [], exercises = [], settings = [], meta = [] } = backup.data;
  await dexieDb.transaction(
    "rw",
    dexieDb.foods, dexieDb.meals, dexieDb.logs, dexieDb.exercises, dexieDb.settings, dexieDb.meta,
    async () => {
      await dexieDb.foods.clear();
      await dexieDb.meals.clear();
      await dexieDb.logs.clear();
      await dexieDb.exercises.clear();
      await dexieDb.settings.clear();
      await dexieDb.meta.clear();

      if (foods.length) await dexieDb.foods.bulkAdd(foods);
      if (meals.length) await dexieDb.meals.bulkAdd(meals);
      if (logs.length) await dexieDb.logs.bulkAdd(logs);
      if (exercises.length) await dexieDb.exercises.bulkAdd(exercises);
      if (settings.length) await dexieDb.settings.bulkAdd(settings);
      if (meta.length) await dexieDb.meta.bulkAdd(meta);
    }
  );
};