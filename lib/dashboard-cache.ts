import type { ClinVarResponse } from "@/components/clinvar-summary"
import type { Trait } from "@/types/trait"

export interface DashboardData {
  totalSnps: number
  ancestry: Record<string, number>
  haplogroups: { y_hap?: string; mt_hap?: string }
  clinvar: ClinVarResponse
  traits: Trait[]
}

interface Entry {
  expires: number
  promise: Promise<DashboardData>
  value?: DashboardData
}
const entries = new Map<string, Entry>()

export function clearDashboardCache() {
  entries.clear()
}

export function cachedDashboard(id: string) {
  const entry = entries.get(id)
  return entry && entry.expires > Date.now() ? entry : undefined
}

export function loadDashboard(id: string): Promise<DashboardData> {
  const cached = cachedDashboard(id)
  if (cached) {
    return cached.promise
  }
  const promise = fetch(`/api/reports/${encodeURIComponent(id)}/dashboard`, {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const value: DashboardData = await response.json()
      entry.value = value
      return value
    })
    .catch((error) => {
      if (entries.get(id) === entry) {
        entries.delete(id)
      }
      throw error
    })
  const entry: Entry = { expires: Date.now() + 300_000, promise }
  entries.set(id, entry)
  if (entries.size > 8) {
    entries.delete(entries.keys().next().value!)
  }
  return promise
}
