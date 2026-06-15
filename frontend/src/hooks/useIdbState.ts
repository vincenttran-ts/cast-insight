import { useEffect, useRef, useState } from 'react'
import { idbGet, idbSet } from '@/lib/idb'

/**
 * useState persisted to IndexedDB. Mirrors useLocalStorage but without the
 * ~5MB quota — used for state that carries base64 screenshots.
 *
 * Hydration is async: state starts at `initialValue`, then loads from IDB on
 * mount. If IDB has nothing for the key but localStorage does (pre-IDB
 * versions of CastInsight), the localStorage value is migrated once.
 * Writes are skipped until hydration completes so the initial value can't
 * clobber stored data.
 */
export function useIdbState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  const hydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    idbGet<T>(key)
      .then((stored) => {
        if (cancelled) return
        if (stored !== undefined) {
          setValue(stored)
        } else {
          // One-time migration from the legacy localStorage key.
          try {
            const legacy = window.localStorage.getItem(key)
            if (legacy !== null) {
              const parsed = JSON.parse(legacy) as T
              setValue(parsed)
              void idbSet(key, parsed).then(() => window.localStorage.removeItem(key))
            }
          } catch {
            /* unparseable legacy value — start fresh */
          }
        }
        hydrated.current = true
      })
      .catch((err) => {
        console.warn(`[CastInsight] IndexedDB unavailable for "${key}":`, err)
        hydrated.current = true
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!hydrated.current) return
    idbSet(key, value).catch((err) => {
      console.warn(`[CastInsight] Failed to persist "${key}" to IndexedDB:`, err)
    })
  }, [key, value])

  return [value, setValue] as const
}
