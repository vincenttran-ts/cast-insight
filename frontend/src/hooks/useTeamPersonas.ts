import { useCallback, useEffect, useRef, useState } from 'react'
import type { Persona } from '@/types'
import { normalizePersona } from '@/lib/personaDefaults'
import {
  deleteTeamPersona,
  fetchTeamPersonas,
  publishPersona,
  updateTeamPersona,
} from '@/lib/personasApi'

export function useTeamPersonas() {
  const [teamPersonas, setTeamPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchTeamPersonas()
      if (!mountedRef.current) return
      setTeamPersonas(list.map((p) => normalizePersona({ ...p, shared: true })))
      setLastFetchedAt(new Date().toISOString())
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load team library')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const publish = useCallback(async (persona: Persona, authorName?: string) => {
    const payload = normalizePersona({
      ...persona,
      shared: true,
      authorName: authorName?.trim() || persona.authorName,
      updatedAt: new Date().toISOString(),
    })
    const saved = await publishPersona(payload)
    const normalized = normalizePersona({ ...saved, shared: true })
    setTeamPersonas((prev) => {
      const exists = prev.some((p) => p.id === normalized.id)
      return exists ? prev.map((p) => (p.id === normalized.id ? normalized : p)) : [...prev, normalized]
    })
    setLastFetchedAt(new Date().toISOString())
    return normalized
  }, [])

  const update = useCallback(async (persona: Persona) => {
    const payload = normalizePersona({
      ...persona,
      shared: true,
      updatedAt: new Date().toISOString(),
    })
    const saved = await updateTeamPersona(payload)
    const normalized = normalizePersona({ ...saved, shared: true })
    setTeamPersonas((prev) => prev.map((p) => (p.id === normalized.id ? normalized : p)))
    setLastFetchedAt(new Date().toISOString())
    return normalized
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteTeamPersona(id)
    setTeamPersonas((prev) => prev.filter((p) => p.id !== id))
    setLastFetchedAt(new Date().toISOString())
  }, [])

  return {
    teamPersonas,
    loading,
    error,
    lastFetchedAt,
    refresh,
    publish,
    update,
    remove,
  }
}
