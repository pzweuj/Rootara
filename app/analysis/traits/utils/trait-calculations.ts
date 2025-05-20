import type { Trait } from "@/types/trait"

// 计算特征分数
export const calculateTraitScore = (trait: Partial<Trait>): number => {
  if (!trait.formula || !trait.rsids || !trait.yourGenotypes) return 0

  try {
    // 解析SCORE公式
    if (trait.formula.startsWith("SCORE(") && trait.formula.endsWith(")")) {
      const formulaContent = trait.formula.substring(6, trait.formula.length - 1)
      const ruleGroups = formulaContent
        .split(";")
        .map((group) => group.trim())
        .filter((g) => g)

      let totalScore = 0

      // 处理每个RSID规则组
      for (const group of ruleGroups) {
        if (!group) continue

        const [rsidPart, scoresPart] = group.split(":").map((part) => part.trim())
        if (!rsidPart || !scoresPart) continue

        const rsid = rsidPart.trim()
        const rsidIndex = trait.rsids.findIndex((r) => r === rsid)

        if (rsidIndex === -1 || !trait.yourGenotypes[rsidIndex]) continue

        const userGenotype = trait.yourGenotypes[rsidIndex]
        const scoreRules = scoresPart.split(",").map((rule) => {
          const [genotype, scoreStr] = rule.split("=").map((r) => r.trim())
          return { genotype, score: Number.parseInt(scoreStr, 10) }
        })

        const matchingRule = scoreRules.find((rule) => rule.genotype === userGenotype)
        if (matchingRule) {
          totalScore += matchingRule.score
        }
      }

      return totalScore
    }
    // 解析IF条件公式
    else if (trait.formula.startsWith("IF(") && trait.formula.endsWith(")")) {
      const formulaContent = trait.formula.substring(3, trait.formula.length - 1)
      const parts = formulaContent.split(",").map((part) => part.trim())

      if (parts.length < 3) return 0

      // 解析条件
      const condition = parts[0]
      const trueValue = Number.parseInt(parts[1], 10)
      const falseValue = Number.parseInt(parts[2], 10)

      // 解析条件表达式，例如 "rs123=AG"
      const [rsid, expectedGenotype] = condition.split("=").map((part) => part.trim())
      const rsidIndex = trait.rsids.findIndex((r) => r === rsid)

      if (rsidIndex === -1 || !trait.yourGenotypes[rsidIndex]) return falseValue

      const userGenotype = trait.yourGenotypes[rsidIndex]
      return userGenotype === expectedGenotype ? trueValue : falseValue
    }
    // 支持组合公式：IF(condition, SCORE(...), value)
    else if (trait.formula.includes("IF(") && trait.formula.includes("SCORE(")) {
      // 提取IF条件
      const ifMatch = trait.formula.match(/IF\((.*?),(.*),(.*)/)
      if (!ifMatch || ifMatch.length < 4) return 0

      const condition = ifMatch[1].trim()
      const trueExpr = ifMatch[2].trim()
      const falseExpr = ifMatch[3].trim()

      // 解析条件
      const [rsid, expectedGenotype] = condition.split("=").map((part) => part.trim())
      const rsidIndex = trait.rsids.findIndex((r) => r === rsid)

      if (rsidIndex === -1 || !trait.yourGenotypes[rsidIndex]) {
        // 条件不满足，返回falseExpr的值
        return isNaN(Number(falseExpr)) ? 0 : Number(falseExpr)
      }

      const userGenotype = trait.yourGenotypes[rsidIndex]

      if (userGenotype === expectedGenotype) {
        // 条件满足，计算trueExpr
        if (trueExpr.startsWith("SCORE(")) {
          // 递归调用计算SCORE
          const tempTrait = { ...trait, formula: trueExpr }
          return calculateTraitScore(tempTrait)
        } else {
          return isNaN(Number(trueExpr)) ? 0 : Number(trueExpr)
        }
      } else {
        // 条件不满足，返回falseExpr
        if (falseExpr.startsWith("SCORE(")) {
          // 递归调用计算SCORE
          const tempTrait = { ...trait, formula: falseExpr }
          return calculateTraitScore(tempTrait)
        } else {
          return isNaN(Number(falseExpr)) ? 0 : Number(falseExpr)
        }
      }
    }

    return 0
  } catch (error) {
    console.error("Error calculating trait score:", error)
    return 0
  }
}

// 根据分数和阈值确定结果
export const determineResult = (trait: Partial<Trait>): { en: string; "zh-CN": string } => {
  if (!trait.scoreThresholds || Object.keys(trait.scoreThresholds).length === 0) {
    return { en: "", "zh-CN": "" }
  }

  const score = calculateTraitScore(trait)

  // 按分数阈值从高到低排序
  const sortedThresholds = Object.entries(trait.scoreThresholds).sort((a, b) => b[1] - a[1])

  // 找到第一个分数小于等于计算分数的阈值
  for (const [result, threshold] of sortedThresholds) {
    if (score >= threshold) {
      return { en: result, "zh-CN": result }
    }
  }

  // 如果没有匹配的阈值，返回分数最低的结果
  const lowestResult = sortedThresholds[sortedThresholds.length - 1][0]
  return { en: lowestResult, "zh-CN": lowestResult }
}
