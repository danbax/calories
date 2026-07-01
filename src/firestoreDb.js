import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db as firestoreDb } from "./firebaseConfig";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getCollectionRef = (userId, table) =>
  collection(firestoreDb, `users/${userId}/${table}`);

const getDocRef = (userId, table, docId) =>
  doc(firestoreDb, `users/${userId}/${table}`, String(docId));

const snapshotToArray = (snapshot) =>
  snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

// ─── Auth-aware access ──────────────────────────────────────────────────────

let _currentUserId = null;

export function setCurrentUser(userId) {
  _currentUserId = userId;
}

export function getCurrentUserId() {
  return _currentUserId;
}

export function isFirestoreMode() {
  return _currentUserId != null;
}

// ─── Foods ──────────────────────────────────────────────────────────────────

export const searchFoods = async (userId, queryText, resultLimit = 20) => {
  if (!queryText) {
    const snapshot = await getDocs(
      query(getCollectionRef(userId, "foods"), orderBy("name"), limit(resultLimit))
    );
    return snapshotToArray(snapshot);
  }

  const normalized = queryText.toLowerCase().trim();
  const end = normalized + "\uf8ff";

  // startsWith via range query
  const snapshot = await getDocs(
    query(
      getCollectionRef(userId, "foods"),
      where("searchName", ">=", normalized),
      where("searchName", "<=", end),
      orderBy("searchName"),
      limit(resultLimit)
    )
  );

  const results = snapshotToArray(snapshot);

  if (results.length >= resultLimit) {
    return results;
  }

  // Fallback: we can't do client-side includes easily in Firestore,
  // so return what we have (startsWith results already cover the common case).
  return results;
};

export const getAllFoods = async (userId) => {
  const snapshot = await getDocs(
    query(getCollectionRef(userId, "foods"), orderBy("name"))
  );
  return snapshotToArray(snapshot);
};

export const addFood = async (userId, food) => {
  const docRef = await addDoc(getCollectionRef(userId, "foods"), food);
  return docRef.id;
};

export const bulkPutFoods = async (userId, foods) => {
  const batch = writeBatch(firestoreDb);
  for (const food of foods) {
    const ref = food.id
      ? getDocRef(userId, "foods", food.id)
      : doc(getCollectionRef(userId, "foods"));
    batch.set(ref, food);
  }
  await batch.commit();
};

// ─── Meals ──────────────────────────────────────────────────────────────────

export const getAllMeals = async (userId) => {
  const snapshot = await getDocs(
    query(getCollectionRef(userId, "meals"), orderBy("name"))
  );
  return snapshotToArray(snapshot);
};

export const addMeal = async (userId, meal) => {
  const docRef = await addDoc(getCollectionRef(userId, "meals"), meal);
  return docRef.id;
};

export const updateMeal = async (userId, mealId, data) => {
  await updateDoc(getDocRef(userId, "meals", mealId), data);
};

export const deleteMeal = async (userId, mealId) => {
  await deleteDoc(getDocRef(userId, "meals", mealId));
};

// ─── Logs ───────────────────────────────────────────────────────────────────

export const addLog = async (userId, logEntry) => {
  const docRef = await addDoc(getCollectionRef(userId, "logs"), {
    ...logEntry,
    timestamp: logEntry.timestamp ?? Date.now(),
  });
  return docRef.id;
};

export const getLogsForDate = async (userId, dateKey) => {
  const snapshot = await getDocs(
    query(
      getCollectionRef(userId, "logs"),
      where("dateKey", "==", dateKey),
      orderBy("timestamp", "desc")
    )
  );
  return snapshotToArray(snapshot);
};

export const getLogsBetweenDates = async (userId, startDateKey, endDateKey) => {
  const snapshot = await getDocs(
    query(
      getCollectionRef(userId, "logs"),
      where("dateKey", ">=", startDateKey),
      where("dateKey", "<=", endDateKey),
      orderBy("dateKey"),
      orderBy("timestamp", "desc")
    )
  );
  return snapshotToArray(snapshot);
};

export const updateLog = async (userId, logId, data) => {
  await updateDoc(getDocRef(userId, "logs", logId), data);
};

export const deleteLog = async (userId, logId) => {
  await deleteDoc(getDocRef(userId, "logs", logId));
};

export const getRecentLogEntries = async (userId, resultLimit = 8) => {
  const snapshot = await getDocs(
    query(
      getCollectionRef(userId, "logs"),
      orderBy("timestamp", "desc"),
      limit(resultLimit * 8)
    )
  );
  const rows = snapshotToArray(snapshot);
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

    if (result.length >= resultLimit) {
      break;
    }
  }

  return result;
};

// ─── Exercises ──────────────────────────────────────────────────────────────

export const addExercise = async (userId, exercise) => {
  const docRef = await addDoc(getCollectionRef(userId, "exercises"), exercise);
  return docRef.id;
};

export const updateExercise = async (userId, exerciseId, data) => {
  await updateDoc(getDocRef(userId, "exercises", exerciseId), data);
};

export const deleteExercise = async (userId, exerciseId) => {
  await deleteDoc(getDocRef(userId, "exercises", exerciseId));
};

export const getExercisesForDate = async (userId, dateKey) => {
  const snapshot = await getDocs(
    query(
      getCollectionRef(userId, "exercises"),
      where("dateKey", "==", dateKey),
      orderBy("timestamp", "desc")
    )
  );
  return snapshotToArray(snapshot);
};

export const getExercisesBetweenDates = async (userId, startDateKey, endDateKey) => {
  const snapshot = await getDocs(
    query(
      getCollectionRef(userId, "exercises"),
      where("dateKey", ">=", startDateKey),
      where("dateKey", "<=", endDateKey),
      orderBy("dateKey"),
      orderBy("timestamp", "desc")
    )
  );
  return snapshotToArray(snapshot);
};

// ─── Settings ───────────────────────────────────────────────────────────────

export const getSettingsDoc = async (userId) => {
  const ref = doc(firestoreDb, `users/${userId}/settings/_current`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const saveSettingsDoc = async (userId, settingsData) => {
  const ref = doc(firestoreDb, `users/${userId}/settings/_current`);
  await setDoc(ref, settingsData, { merge: true });
};

export const saveSettingsBulk = async (userId, entries) => {
  const ref = doc(firestoreDb, `users/${userId}/settings/_current`);
  const data = {};
  for (const entry of entries) {
    data[entry.key] = entry.value;
  }
  await setDoc(ref, data, { merge: true });
};

// ─── Meta ───────────────────────────────────────────────────────────────────

export const getMeta = async (userId, key) => {
  const ref = doc(firestoreDb, `users/${userId}/meta`, key);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const putMeta = async (userId, entry) => {
  const ref = doc(firestoreDb, `users/${userId}/meta`, entry.key);
  await setDoc(ref, entry);
};

// ─── Export / Restore ───────────────────────────────────────────────────────

export const exportAllData = async (userId) => {
  const [foods, meals, logs, exercises, settingsSnap, meta] = await Promise.all([
    getAllFoods(userId),
    getAllMeals(userId),
    getDocs(query(getCollectionRef(userId, "logs"), orderBy("timestamp"))).then(snapshotToArray),
    getDocs(query(getCollectionRef(userId, "exercises"), orderBy("timestamp"))).then(snapshotToArray),
    getDoc(doc(firestoreDb, `users/${userId}/settings/_current`)).then((s) =>
      s.exists() ? s.data() : {}
    ),
    getDocs(query(getCollectionRef(userId, "meta"))).then(snapshotToArray),
  ]);

  const settingsArray = Object.entries(settingsSnap).map(([key, value]) => ({ key, value }));

  return {
    exportedAt: new Date().toISOString(),
    app: "Calories Coach",
    version: 1,
    data: { foods, meals, logs, exercises, settings: settingsArray, meta },
  };
};

export const restoreAllData = async (userId, backup) => {
  if (!backup?.data) {
    throw new Error("Invalid backup file format.");
  }

  const { foods = [], meals = [], logs = [], exercises = [], settings = [], meta = [] } = backup.data;

  // Clear existing data by deleting collections (batch delete approach)
  const clearCollection = async (tableName) => {
    const snap = await getDocs(query(getCollectionRef(userId, tableName)));
    if (snap.empty) return;
    const b = writeBatch(firestoreDb);
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
  };

  await Promise.all([
    clearCollection("foods"),
    clearCollection("meals"),
    clearCollection("logs"),
    clearCollection("exercises"),
    clearCollection("settings"),
    clearCollection("meta"),
  ]);

  const batch = writeBatch(firestoreDb);

  foods.forEach((item) => {
    const ref = item.id ? getDocRef(userId, "foods", item.id) : doc(getCollectionRef(userId, "foods"));
    batch.set(ref, item);
  });
  meals.forEach((item) => {
    const ref = item.id ? getDocRef(userId, "meals", item.id) : doc(getCollectionRef(userId, "meals"));
    batch.set(ref, item);
  });
  logs.forEach((item) => {
    const ref = item.id ? getDocRef(userId, "logs", item.id) : doc(getCollectionRef(userId, "logs"));
    batch.set(ref, item);
  });
  exercises.forEach((item) => {
    const ref = item.id ? getDocRef(userId, "exercises", item.id) : doc(getCollectionRef(userId, "exercises"));
    batch.set(ref, item);
  });
  settings.forEach((item) => {
    const ref = doc(firestoreDb, `users/${userId}/settings/_current`);
    batch.set(ref, { [item.key]: item.value }, { merge: true });
  });
  meta.forEach((item) => {
    const ref = doc(firestoreDb, `users/${userId}/meta`, item.key);
    batch.set(ref, item);
  });

  await batch.commit();
};