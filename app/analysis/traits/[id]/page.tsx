"use client"

import {
  AlertCircle,
  ArrowLeft,
  Edit,
  Eye,
  Coffee,
  Moon,
  Brain,
  Music,
  Clock,
  Droplet,
  Scissors,
  Utensils,
  Wine,
  Heart,
  Dna,
  Leaf,
  Zap,
  Sun,
  Smile,
  Frown,
  Thermometer,
  Wind,
  Umbrella,
  Flame,
  Snowflake,
  Activity,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import React from "react"
import { useState, useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context"
import {
  getCategoryColor,
  getCategoryName,
  findTraitById,
} from "@/lib/trait-utils"
import type { TraitDetail } from "@/types/trait"

// 添加图标映射对象
const iconMapping: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Eye,
  Coffee,
  Moon,
  Droplet,
  Brain,
  Scissors,
  Utensils,
  Wine,
  Clock,
  Music,
  Heart,
  Dna,
  Leaf,
  Zap,
  Sun,
  Smile,
  Frown,
  Thermometer,
  Wind,
  Umbrella,
  Flame,
  Snowflake,
  Activity,
  AlertCircle,
}

export default function TraitDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const { currentReportId } = useReport()
  const [trait, setTrait] = useState<TraitDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const loadTrait = async () => {
      if (!id || !currentReportId) {
        return
      }

      setLoading(true)

      try {
        const foundTrait = await findTraitById(
          id as string,
          currentReportId,
          controller.signal
        )
        if (controller.signal.aborted) {
          return
        }
        setTrait(foundTrait)
      } catch (error) {
        console.error("Failed to load trait:", error)
        setTrait(null)
      }

      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }

    loadTrait()
    return () => controller.abort()
  }, [id, currentReportId])

  // 在translations对象中添加可信度的翻译
  const translations = {
    en: {
      loading: "Loading trait details...",
      traitNotFound: "Trait not found",
      traitDetails: "Trait Details",
      result: "Result",
      description: "Description",
      confidence: "Confidence",
      category: "Category",
      createdAt: "Created",
      backToTraits: "Back to Traits",
      edit: "Edit",
      geneticData: "Genetic Data",
      rsid: "RSID",
      referenceGenotype: "Reference Genotype",
      yourGenotype: "Your Genotype",
      formula: "Calculation Formula",
      noGeneticData: "No genetic data available for this trait",
      insufficientData: "Insufficient genetic data for a reliable result",
      invalidRule: "This rule is not currently available for evaluation",
      reviewRequired:
        "This rule is awaiting independent evidence review and is not presented as a validated result",
      scoreThresholds: "Score Thresholds",
      resultName: "Result",
      minimumScore: "Minimum Score",
      reference: "Reference",
      // 添加可信度翻译
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    "zh-CN": {
      loading: "正在加载特征详情...",
      traitNotFound: "未找到特征",
      traitDetails: "特征详情",
      result: "结果",
      description: "描述",
      confidence: "可信度",
      category: "类别",
      createdAt: "创建于",
      backToTraits: "返回特征列表",
      edit: "编辑",
      geneticData: "基因数据",
      rsid: "RSID",
      referenceGenotype: "参考基因型",
      yourGenotype: "您的基因型",
      formula: "计算公式",
      noGeneticData: "此特征没有可用的基因数据",
      insufficientData: "基因数据不足，无法可靠计算此结果",
      invalidRule: "此规则当前无法计算",
      reviewRequired: "该规则尚未完成独立证据审核，暂不作为已验证结果展示",
      scoreThresholds: "分数阈值",
      resultName: "结果",
      minimumScore: "最小分数",
      reference: "参考文献",
      // 添加可信度翻译
      high: "高",
      medium: "中等",
      low: "低",
    },
  }

  const t = (key: keyof typeof translations.en) => {
    return translations[language as keyof typeof translations][key] || key
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>{t("loading")}</p>
      </div>
    )
  }

  if (!trait) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-xl font-medium">{t("traitNotFound")}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/analysis/traits")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToTraits")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        onClick={() => router.push("/analysis/traits")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("backToTraits")}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-full">
                {React.createElement(iconMapping[trait.icon || "Dna"] || Dna, {
                  className: "h-6 w-6",
                })}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {trait.name[language as keyof typeof trait.name] ||
                    trait.name.default}
                </CardTitle>
                <CardDescription>{t("traitDetails")}</CardDescription>
              </div>
            </div>
            <Badge className={getCategoryColor(trait.category)}>
              {getCategoryName(trait.category, language)}
            </Badge>
            {trait.isDefault === false && (
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                {t("edit")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{t("result")}</h3>
            {trait.evaluation.status === "insufficient_data" ? (
              <div className="text-muted-foreground">
                <p>{t("insufficientData")}</p>
                <p className="mt-1 font-mono text-sm">
                  {language === "zh-CN" ? "未检测到：" : "Missing: "}
                  {trait.evaluation.missingRsids?.join("、")}
                </p>
              </div>
            ) : trait.evaluation.status === "invalid_rule" ||
              trait.evaluation.status === "invalid_orientation" ? (
              <p className="text-muted-foreground">{t("invalidRule")}</p>
            ) : (
              <p className="text-xl">
                {trait.evaluation.resultCurrent?.[language] ||
                  trait.evaluation.resultCurrent?.default}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium">{t("description")}</h3>
            <p>
              {trait.description[language as keyof typeof trait.description] ||
                trait.description.default}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t("confidence")}</h3>
              <div>
                <Badge
                  variant="outline"
                  className={
                    trait.confidence === "high"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : trait.confidence === "medium"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }
                >
                  {t(
                    (trait.confidence || "low") as keyof typeof translations.en
                  )}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t("category")}</h3>
              <div>
                <Badge className={getCategoryColor(trait.category)}>
                  {getCategoryName(trait.category, language)}
                </Badge>
              </div>
            </div>
          </div>

          {trait.evidenceGrade && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">
                {language === "zh-CN" ? "证据等级" : "Evidence grade"}
              </h3>
              <Badge variant="outline">{trait.evidenceGrade}</Badge>
              {trait.limitations?.[language]?.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {trait.limitations[language].map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              )}
              {trait.populationScope?.[language] && (
                <p className="text-sm text-muted-foreground">
                  {language === "zh-CN" ? "适用人群：" : "Population scope: "}
                  {trait.populationScope[language]}
                </p>
              )}
              {trait.medicalDisclaimer && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {language === "zh-CN"
                    ? "本结果仅供信息参考；用药选择和剂量必须遵循最新临床指南，并由合格的医疗专业人员评估。"
                    : trait.medicalDisclaimer}
                </p>
              )}
              {trait.evidenceSummary?.[language] && (
                <p className="text-sm text-muted-foreground">
                  {trait.evidenceSummary[language]}
                </p>
              )}
            </div>
          )}

          {/* Genetic Data Section */}
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium mb-3">{t("geneticData")}</h3>
            {trait.loci.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          {t("rsid")}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          {language === "zh-CN"
                            ? "GRCh38 位点/等位基因"
                            : "GRCh38 locus/alleles"}
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          {t("yourGenotype")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trait.loci.map((locus) => (
                        <tr key={locus.rsid} className="border-t">
                          <td className="px-4 py-2 text-sm">
                            <div>{locus.rsid}</div>
                            {locus.gene && (
                              <div className="text-xs text-muted-foreground">
                                {locus.gene}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm font-mono">
                            {locus.assembly.GRCh38.chromosome &&
                            locus.assembly.GRCh38.position
                              ? `chr${locus.assembly.GRCh38.chromosome}:${locus.assembly.GRCh38.position}`
                              : language === "zh-CN"
                                ? "位点核验中"
                                : "Pending verification"}
                            {locus.assembly.GRCh37?.chromosome &&
                              locus.assembly.GRCh37.position && (
                                <div className="text-xs text-muted-foreground">
                                  {`GRCh37 chr${locus.assembly.GRCh37.chromosome}:${locus.assembly.GRCh37.position}`}
                                </div>
                              )}
                            <div>
                              {[
                                locus.referenceAllele,
                                ...locus.alternateAlleles,
                              ]
                                .filter(Boolean)
                                .join("/")}
                              {locus.effectAllele
                                ? ` · ${language === "zh-CN" ? "效应" : "effect"} ${locus.effectAllele}`
                                : ""}
                              {locus.effectDirection
                                ? ` (${locus.effectDirection})`
                                : ""}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm font-mono">
                            {trait.evaluation.genotypes[locus.rsid] ||
                              (language === "zh-CN"
                                ? "未检测到"
                                : "Not detected")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {trait.formula && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("formula")}</h4>
                    <div className="bg-muted/30 p-3 rounded-md font-mono text-sm overflow-x-auto">
                      {trait.formula}
                    </div>
                  </div>
                )}

                {trait.scoreThresholds &&
                  Object.keys(trait.scoreThresholds).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">
                        {t("scoreThresholds")}
                      </h4>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium">
                                {t("resultName")}
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-medium">
                                {t("minimumScore")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(trait.scoreThresholds)
                              .sort((a, b) => {
                                // 如果两个值都是布尔值
                                if (
                                  typeof a[1] === "boolean" &&
                                  typeof b[1] === "boolean"
                                ) {
                                  return b[1] === a[1] ? 0 : b[1] ? -1 : 1 // true排在false前面
                                }
                                // 如果只有a是布尔值
                                if (typeof a[1] === "boolean") {
                                  return -1
                                }
                                // 如果只有b是布尔值
                                if (typeof b[1] === "boolean") {
                                  return 1
                                }
                                // 如果都是数字，按降序排序
                                return b[1] - a[1]
                              })
                              .map(([result, score], index) => (
                                <tr key={index} className="border-t">
                                  <td className="px-4 py-2 text-sm">
                                    {result}
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    {score.toString()}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {trait.evidence && trait.evidence.length > 0 && (
                  <div className="pt-4 border-t space-y-2">
                    {" "}
                    {/* Added pt-4 border-t */}
                    <h3 className="text-lg font-medium mb-3">
                      {t("reference")}
                    </h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {trait.evidence.map((item) => (
                        <li key={`${item.type}:${item.id}`}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {item.type}: {item.id}
                            {item.title ? ` — ${item.title}` : ""}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("noGeneticData")}
              </p>
            )}
          </div>

          {trait.isDefault === false && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t("createdAt")}:{" "}
                {trait.createdAt
                  ? new Date(trait.createdAt).toLocaleDateString()
                  : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
