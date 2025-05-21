import type { Trait } from "@/types/trait"
import defaultTraitsData from "@/data/default-traits.json"

/**
 * Loads all traits (default and user-created)
 */
export function loadAllTraits(): Trait[] {
  try {
    // Load default traits
    const defaultTraits = defaultTraitsData as unknown as Trait[]

    // Load user traits from localStorage if available
    if (typeof window !== "undefined") {
      const savedTraits = localStorage.getItem("userTraits")
      if (savedTraits) {
        const parsedTraits = JSON.parse(savedTraits) as Trait[]
        // Combine default traits with user traits
        return [...defaultTraits, ...parsedTraits]
      }
    }

    return defaultTraits
  } catch (error) {
    console.error("Failed to load traits:", error)
    return defaultTraitsData as unknown as Trait[]
  }
}

/**
 * Saves user-created traits to localStorage
 */
export function saveUserTraits(traits: Trait[]): void {
  try {
    // Filter out default traits before saving
    const userTraits = traits.filter((trait) => !trait.isDefault)
    localStorage.setItem("userTraits", JSON.stringify(userTraits))
  } catch (error) {
    console.error("Failed to save traits:", error)
  }
}

/**
 * Finds a trait by ID
 */
export function findTraitById(id: string): Trait | null {
  const allTraits = loadAllTraits()
  return allTraits.find((trait) => trait.id === id) || null
}

/**
 * Calculates the score for a trait based on genotypes
 */
export function calculateTraitScore(trait: Trait): number {
  if (!trait.formula.startsWith("SCORE(")) {
    return 0
  }

  try {
    // Extract the scoring rules from the formula
    // Format: SCORE(rs123:AA=10,AG=5,GG=0; rs456:CC=5,CT=3,TT=0)
    const formulaContent = trait.formula.substring(6, trait.formula.length - 1)
    const ruleGroups = formulaContent.split(";").map((group) => group.trim())

    let totalScore = 0

    // Process each RSID rule group
    ruleGroups.forEach((group) => {
      const [rsidPart, scoresPart] = group.split(":")
      const rsid = rsidPart.trim()

      // Find the index of this RSID in the trait's RSID array
      const rsidIndex = trait.rsids.findIndex((r) => r === rsid)
      if (rsidIndex === -1) return

      // Get the user's genotype for this RSID
      const userGenotype = trait.yourGenotypes[rsidIndex]
      if (!userGenotype) return

      // Parse the score rules
      const scoreRules = scoresPart.split(",").map((rule) => {
        const [genotype, scoreStr] = rule.split("=")
        return {
          genotype: genotype.trim(),
          score: Number.parseInt(scoreStr, 10),
        }
      })

      // Find the matching score rule for the user's genotype
      const matchingRule = scoreRules.find((rule) => rule.genotype === userGenotype)
      if (matchingRule) {
        totalScore += matchingRule.score
      }
    })

    return totalScore
  } catch (error) {
    console.error("Error calculating trait score:", error)
    return 0
  }
}

/**
 * Determines the result for a trait based on its score or boolean values
 */
export function determineTraitResult(trait: Trait, language = "en"): string {
  const score = calculateTraitScore(trait)

  // 分离数字阈值和布尔值阈值
  const numericThresholds: [string, number][] = []
  const booleanThresholds: [string, boolean][] = []

  Object.entries(trait.scoreThresholds).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      booleanThresholds.push([key, value])
    } else {
      numericThresholds.push([key, value])
    }
  })

  // 如果有布尔值为true的阈值，优先返回它
  const trueThreshold = booleanThresholds.find(([_, value]) => value === true)
  if (trueThreshold) {
    return trueThreshold[0]
  }

  // Sort thresholds in descending order
  const sortedThresholds = numericThresholds.sort((a, b) => b[1] - a[1])

  // Find the first threshold that the score meets or exceeds
  for (const [result, threshold] of sortedThresholds) {
    if (score >= threshold) {
      return result
    }
  }

  // If no threshold is met, return the lowest numeric threshold or first boolean false
  if (sortedThresholds.length > 0) {
    return sortedThresholds[sortedThresholds.length - 1][0]
  } else if (booleanThresholds.length > 0) {
    return booleanThresholds[0][0]
  }

  // If no thresholds at all (shouldn't happen with proper setup)
  return Object.keys(trait.scoreThresholds)[0] || ""
}

/**
 * Gets the category badge color
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    appearance: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    internal: "bg-purple-300 text-purple-900 dark:bg-purple-700 dark:text-purple-100",
    nutrition: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    risk: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    lifestyle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    default: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }

  return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
}

/**
 * Gets the category name in the current language
 */
export function getCategoryName(category: string, language = "en"): string {
  const categoryNames: Record<string, Record<string, string>> = {
    appearance: { en: "Appearance", "zh-CN": "外观" },
    internal: { en: "Internal", "zh-CN": "内在" },
    nutrition: { en: "Nutrition", "zh-CN": "营养" },
    risk: { en: "Risk", "zh-CN": "风险" },
    lifestyle: { en: "Lifestyle", "zh-CN": "生活" },
    all: { en: "All Categories", "zh-CN": "所有类别" },
  }

  return categoryNames[category]?.[language] || category
}
