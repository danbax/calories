import Dexie from 'dexie'

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

const dexieDb = new CaloriesDB()
export default dexieDb