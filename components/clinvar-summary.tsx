"use client"

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

// 定义ClinVar数据类型
interface ClinVarVariant {
  row_id: number
  classification: string
  chromosome: string
  position: number
  ref: string
  alt: string
  gene: string
  rsid: string
  gnomAD_AF: number | string
  clnsig: string
  clndn: string
  genotype: string
  gt: string
}

export interface ClinVarResponse {
  total: number
  data: Record<string, ClinVarVariant>
  statistics: {
    pathogenic: number
    likely_pathogenic: number
    benign: number
    likely_benign: number
    uncertain_significance: number
  }
}

export function ClinvarSummary({
  clinvarData,
}: {
  clinvarData: ClinVarResponse
}) {
  const { t } = useLanguage()
  const getClassificationIcon = (classification: string) => {
    const lowerClass = classification.replace(/_/g, " ")

    if (lowerClass === "pathogenic") {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    } else if (lowerClass.includes("likely pathogenic")) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    } else if (
      lowerClass.includes("uncertain") ||
      lowerClass.includes("risk factor")
    ) {
      return <Info className="h-4 w-4 text-blue-500" />
    } else if (lowerClass.includes("likely benign")) {
      return <Info className="h-4 w-4 text-teal-500" />
    } else if (lowerClass.includes("benign")) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else {
      return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const recentFindings = Object.values(clinvarData.data)

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-base sm:text-lg font-medium">
          {t("clinvarAnalysis")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="space-y-4 w-full overflow-hidden">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 w-full">
            <div className="bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400">
                {clinvarData.statistics.pathogenic}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400 leading-tight break-words">
                {t("pathogenicVariants")}
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {clinvarData.statistics.likely_pathogenic}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 leading-tight break-words">
                {t("likelyPathogenic")}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0 xs:col-span-2 sm:col-span-1">
              <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                {clinvarData.statistics.uncertain_significance}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 leading-tight break-words">
                {t("uncertainSignificance")}
              </div>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">
                {clinvarData.statistics.likely_benign}
              </div>
              <div className="text-xs text-teal-600 dark:text-teal-400 leading-tight break-words">
                {t("likelyBenign")}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
                {clinvarData.statistics.benign}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 leading-tight break-words">
                {t("benign")}
              </div>
            </div>
          </div>

          <div className="mt-4 w-full overflow-hidden">
            <h3 className="text-sm font-medium mb-2">{t("recentFindings")}</h3>
            <div className="space-y-2 w-full">
              {recentFindings.map((finding) => (
                <div
                  key={finding.row_id}
                  className="border rounded-md p-2 sm:p-3 w-full overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                      <div className="flex-shrink-0">
                        {getClassificationIcon(finding.classification)}
                      </div>
                      <span className="ml-2 font-medium text-sm truncate">
                        {finding.gene}
                      </span>
                    </div>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      {finding.rsid}
                    </span>
                  </div>
                  <p
                    className="text-xs text-muted-foreground mt-1 truncate w-full"
                    title={finding.clndn}
                  >
                    {finding.clndn}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground w-full">
            <span className="text-xs sm:text-sm truncate">
              {t("totalVariants")}: {clinvarData.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-foreground w-full sm:w-auto flex-shrink-0"
              asChild
            >
              <Link href="/analysis/clinvar">
                <span className="text-xs sm:text-sm">{t("viewDetails")}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
