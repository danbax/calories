import { collection, writeBatch, doc } from "firebase/firestore";
import { db as firestoreDb } from "./firebaseConfig";
import dexieDb from "./dexieDb";

const MIGRATION_FLAG_KEY = "calories_migrated_to_firestore";

/**
 * Checks if the current user's data has already been migrated from Dexie to Firestore.
 */
export function hasBeenMigrated(userId) {
  return localStorage.getItem(`${MIGRATION_FLAG_KEY}_${userId}`) === "true";
}

/**
 * Marks migration as complete for the given user.
 */
export function markMigrated(userId) {
  localStorage.setItem(`${MIGRATION_FLAG_KEY}_${userId}`, "true");
}

/**
 * Migrates all local Dexie data to Firestore under the user's UID.
 * This is a one-shot operation — subsequent calls are no-ops.
 *
 * Data is written collections:
 *   users/{userId}/foods
 *   users/{userId}/meals
 *   users/{userId}/logs
 *   users/{userId}/exercises
 *   users/{userId}/settings
 *   users/{userId}/meta
 */
export async function migrateLocalDataToCloud(userId) {
  if (hasBeenMigrated(userId)) {
    return { migrated: false, reason: "already_migrated" };
  }

  try {
    // 1. Read all local data from Dexie tables
    const [foods, meals, logs, exercises, settings, meta] = await Promise.all([
      dexieDb.foods.toArray(),
      dexieDb.meals.toArray(),
      dexieDb.logs.toArray(),
      dexieDb.exercises.toArray(),
      dexieDb.settings.toArray(),
      dexieDb.meta.toArray(),
    ]);

    const totalItems =
      foods.length +
      meals.length +
      logs.length +
      exercises.length +
      settings.length +
      meta.length;

    if (totalItems === 0) {
      markMigrated(userId);
      return { migrated: true, itemsMigrated: 0 };
    }

    // 2. Write data in batches (Firestore max 500 operations per batch)
    // We write each table to its own subcollection under the user document
    const tables = [
      { name: "foods", data: foods },
      { name: "meals", data: meals },
      { name: "logs", data: logs },
      { name: "exercises", data: exercises },
      { name: "settings", data: settings },
      { name: "meta", data: meta },
    ];

    let totalWritten = 0;
    let batch = writeBatch(firestoreDb);
    let operationCount = 0;

    const flushBatch = async () => {
      if (operationCount === 0) return;
      await batch.commit();
      totalWritten += operationCount;
      batch = writeBatch(firestoreDb);
      operationCount = 0;
    };

    for (const table of tables) {
      for (const item of table.data) {
        // Use the Dexie-generated id as the document id for consistency
        const docRef = doc(
          collection(firestoreDb, `users/${userId}/${table.name}`),
          String(item.id)
        );
        batch.set(docRef, { ...item, _migratedAt: new Date().toISOString() });
        operationCount += 1;

        if (operationCount >= 490) {
          await flushBatch();
        }
      }
    }

    // Flush any remaining operations
    await flushBatch();

    // 3. Write a migration marker document
    const markerRef = doc(
      collection(firestoreDb, `users/${userId}/_meta`),
      "migration"
    );
    await batch.set(markerRef, {
      completedAt: new Date().toISOString(),
      itemsMigrated: totalItems,
      version: 1,
    });
    await batch.commit();

    // 4. Mark migration as complete in localStorage
    markMigrated(userId);

    // 5. Optionally clear Dexie tables to free device space
    await Promise.all([
      dexieDb.foods.clear(),
      dexieDb.meals.clear(),
      dexieDb.logs.clear(),
      dexieDb.exercises.clear(),
      dexieDb.settings.clear(),
      dexieDb.meta.clear(),
    ]);

    return { migrated: true, itemsMigrated: totalItems };
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}