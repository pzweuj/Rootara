export interface Trait {
  id: string
  name: {
    en: string
    "zh-CN": string
  }
  result: {
    en: string
    "zh-CN": string
  }
  description: {
    en: string
    "zh-CN": string
  }
  icon: string
  confidence: "high" | "medium" | "low"
  isDefault: boolean
  createdAt: string
  category: "appearance" | "sensory" | "nutrition" | "sleep" | "cognitive"
  rsids: string[]
  referenceGenotypes: string[]
  yourGenotypes: string[]
  formula: string
  scoreThresholds: Record<string, number>
}

export type TraitCategory = "appearance" | "sensory" | "nutrition" | "sleep" | "cognitive" | "all"
