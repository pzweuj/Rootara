export interface LocalizedText {
  en: string
  "zh-CN": string
  default?: string
}

export interface VariantLocus {
  rsid: string
  gene?: string | null
  assembly: {
    GRCh38: { chromosome?: string | null; position?: number | null }
    GRCh37?: { chromosome?: string | null; position?: number | null }
  }
  referenceAllele?: string | null
  alternateAlleles: string[]
  traitAlleles?: string[]
  effectAllele?: string | null
  effectDirection?: string | null
  inputTransform?: "identity" | "complement" | "conflict" | null
  verificationStatus?: string
  sources?: Record<string, unknown>
  reviewedAt?: string
}

export interface TraitSummary {
  id: string
  name: LocalizedText
  description: LocalizedText
  icon?: string
  confidence?: "high" | "medium" | "low"
  isDefault?: boolean
  category: "appearance" | "internal" | "nutrition" | "risk" | "lifestyle"
  evidenceGrade?: "A" | "B"
  evidenceStatus?: string
  sourceLabel?: string
  loci: VariantLocus[]
}

export interface TraitEvaluation {
  traitId: string
  status: "ok" | "insufficient_data" | "invalid_orientation" | "invalid_rule"
  resultKey?: string | null
  resultCurrent?: LocalizedText | null
  genotypes: Record<string, string | null>
  missingRsids?: string[]
  detectedCount?: number
  requiredCount?: number
}

export interface TraitCatalogResponse {
  version: string
  count: number
  traits: TraitSummary[]
}

export interface TraitResultsResponse {
  catalogVersion: string
  reportId: string
  count: number
  results: TraitEvaluation[]
}

export interface TraitCardModel extends TraitSummary {
  evaluation: TraitEvaluation
}

export interface TraitDetail extends TraitSummary {
  catalogVersion: string
  createdAt?: string
  formula: string
  scoreThresholds: Record<string, number | boolean>
  result: Record<string, LocalizedText>
  populationScope: LocalizedText
  limitations: { en: string[]; "zh-CN": string[]; default: string[] }
  evidenceSummary?: LocalizedText
  evidence: Trait["evidence"]
  medicalDisclaimer?: string
  evaluation: TraitEvaluation
}

export interface Trait {
  id: string
  name: {
    en: string
    "zh-CN": string
    default: string
  }
  result: Record<
    string,
    {
      en: string
      "zh-CN": string
      default: string
    }
  >
  result_current?: {
    en: string
    "zh-CN": string
    default: string
  }
  evaluationStatus?:
    | "ok"
    | "insufficient_data"
    | "invalid_rule"
    | "review_required"
  description: {
    en: string
    "zh-CN": string
    default: string
  }
  icon: string
  confidence: "high" | "medium" | "low"
  isDefault: boolean
  createdAt: string
  category: "appearance" | "internal" | "nutrition" | "risk" | "lifestyle"
  rsids: string[]
  referenceGenotypes?: string[]
  yourGenotypes?: string[]
  formula: string
  scoreThresholds: Record<string, number | boolean>
  reference: string[]
  evidenceStatus?: string
  evidenceGrade?: string
  populationScope?: string
  evidence?: Array<{
    type: string
    id: string
    role?: string
    title?: string
    journal?: string
    year?: number
    studyType?: string
    population?: string
    effectAllele?: string
    direction?: string
    url?: string
    supports?: string[]
  }>
  limitations?: string[]
  reviewBlockers?: string[]
  medicalDisclaimer?: string
}

export type TraitCategory =
  | "appearance"
  | "internal"
  | "nutrition"
  | "risk"
  | "lifestyle"
  | "all"
