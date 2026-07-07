import type { Persona } from '@/types'

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return res.json().catch(() => ({}))
}

export async function fetchTeamPersonas(): Promise<Persona[]> {
  const res = await fetch('/api/personas')
  const body = await parseJson(res)
  if (!res.ok) {
    throw new Error(String(body.error || `Failed to load team personas (${res.status})`))
  }
  return Array.isArray(body.personas) ? body.personas : []
}

export async function publishPersona(persona: Persona): Promise<Persona> {
  const res = await fetch('/api/personas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  })
  const body = await parseJson(res)
  if (!res.ok) {
    throw new Error(String(body.error || `Failed to publish persona (${res.status})`))
  }
  return body.persona as Persona
}

export async function updateTeamPersona(persona: Persona): Promise<Persona> {
  const res = await fetch(`/api/personas/${encodeURIComponent(persona.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  })
  const body = await parseJson(res)
  if (!res.ok) {
    throw new Error(String(body.error || `Failed to update persona (${res.status})`))
  }
  return body.persona as Persona
}

export async function deleteTeamPersona(id: string): Promise<void> {
  const res = await fetch(`/api/personas/${encodeURIComponent(id)}`, { method: 'DELETE' })
  const body = await parseJson(res)
  if (!res.ok) {
    throw new Error(String(body.error || `Failed to delete persona (${res.status})`))
  }
}
