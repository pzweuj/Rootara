export interface Trait {
  id: string
  name: {
    en: string
    "zh-CN": string,
    default: string
  }
  result: {
    en: string
    "zh-CN": string,
    default: string
  },
  result_current: {
    en: string
    "zh-CN": string,
    default: string
  },
  description: {
    en: string
    "zh-CN": string,
    default: string
  }
  icon: string
  confidence: "high" | "medium" | "low"
  isDefault: boolean
  createdAt: string
  category: "appearance" | "internal" | "nutrition" | "risk" | "lifestyle"
  rsids: string[]
  referenceGenotypes: string[]
  yourGenotypes: string[]
  formula: string
  scoreThresholds: Record<string, number | boolean>,
  reference: string[],
}

export type TraitCategory = "appearance" | "internal" | "nutrition" | "risk" | "lifestyle" | "all"
