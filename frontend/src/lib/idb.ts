/**
 * Minimal promise wrapper over native IndexedDB — a single key/value store
 * for CastInsight's image-heavy state (flow steps, saved flows, run history),
 * which outgrows localStorage's ~5MB quota fast once base64 screenshots are
 * attached.
 */

const DB_NAME = 'castinsight'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
  )
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return withStore('readonly', (store) => store.get(key) as IDBRequest<T | undefined>)
}

export function idbSet(key: string, value: unknown): Promise<IDBValidKey> {
  return withStore('readwrite', (store) => store.put(value, key))
}

export function idbDel(key: string): Promise<undefined> {
  return withStore('readwrite', (store) => store.delete(key) as IDBRequest<undefined>)
}
