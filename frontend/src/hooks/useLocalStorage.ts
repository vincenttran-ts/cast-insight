import { useEffect, useRef, useState } from 'react'

/**
 * useState persisted to localStorage. Writes are wrapped in try/catch so a
 * quota overflow (e.g. very large base64 screenshots) degrades to in-memory
 * state instead of crashing the workspace.
 */
export function useLocalStorage<T>(key: string, initialValue: T, revive?: (value: T) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return initialValue
      const parsed = JSON.parse(raw) as T
      return revive ? revive(parsed) : parsed
    } catch {
      return initialValue
    }
  })

  const quotaWarned = useRef(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      if (!quotaWarned.current) {
        quotaWarned.current = true
        console.warn(
          `[CastInsight] localStorage quota exceeded for "${key}" — state stays in memory for this session. ` +
            'Use "Download Config" to persist large flows with screenshots.'
        )
      }
    }
  }, [key, value])

  return [value, setValue] as const
}
