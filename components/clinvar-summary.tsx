"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink, Loader2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context"
import Link from "next/link"

// 定义ClinVar数据类型
interface ClinVarVariant {
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

interface ClinVarResponse {
  data: Record<string, ClinVarVariant>
  statistics: {
    pathogenic: number
    likely_pathogenic: number
    benign: number
    likely_benign: number
    uncertain_significance: number
  }
}

export function ClinvarSummary() {
  const { language, t } = useLanguage()
  const { currentReportId } = useReport()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clinvarData, setClinvarData] = useState<ClinVarResponse | null>(null)
  const prevReportIdRef = useRef<string | null>(null)

  // 获取ClinVar数据的函数
  const fetchClinvarData = async (reportId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // 修改为调用新的API路由
      const response = await fetch(`/api/report/clinvar-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId
        })
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()
      setClinvarData(data)
    } catch (err) {
      console.error("获取ClinVar数据失败:", err)
      setError(err instanceof Error ? err.message : "获取数据失败")
    } finally {
      setLoading(false)
    }
  }

  // 当全局报告ID变化时重新加载数据
  useEffect(() => {
    // 只有当currentReportId存在，并且与之前的reportId不同或者是首次加载时才获取数据
    if (currentReportId && (prevReportIdRef.current !== currentReportId || prevReportIdRef.current === null)) {
      fetchClinvarData(currentReportId)
      // 更新ref以记录当前的reportId
      prevReportIdRef.current = currentReportId
    }
  }, [currentReportId])



  const getClassificationIcon = (classification: string) => {
    const lowerClass = classification.toLowerCase();
    
    if (lowerClass.includes('pathogenic')) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    } else if (lowerClass.includes('likely pathogenic')) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    } else if (lowerClass.includes('uncertain') || lowerClass.includes('risk factor')) {
      return <Info className="h-4 w-4 text-blue-500" />
    } else if (lowerClass.includes('likely benign')) {
      return <Info className="h-4 w-4 text-teal-500" />
    } else if (lowerClass.includes('benign')) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else {
      return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-40 py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">{t("loading")}</span>
        </CardContent>
      </Card>
    )
  }

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-40 py-6">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <span className="ml-2 text-red-500">{t("error")}: {error}</span>
        </CardContent>
      </Card>
    )
  }

  // 如果没有数据，返回空卡片
  if (!clinvarData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">{t("clinvarAnalysis")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            {t("noVariantsFound")}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 将API返回的数据转换为数组形式，方便处理
  const variants = Object.entries(clinvarData.data).map(([rsid, variant]) => ({
    id: rsid,
    ...variant,
    classification: variant.clnsig,
    condition: variant.clndn
  }))

  // 获取前4个变异，优先展示致病和可能致病的位点
  const getTopFindings = () => {
    // 评估变异的分类优先级
    const getClassificationPriority = (classification: string) => {
      const lowerClass = classification.toLowerCase();
      
      // 按优先级顺序评估
      if (lowerClass.includes('pathogenic') && !lowerClass.includes('likely')) {
        return 1; // 致病
      } else if (lowerClass.includes('likely pathogenic') || lowerClass.includes('likely_pathogenic')) {
        return 2; // 可能致病
      } else if (lowerClass.includes('benign') && !lowerClass.includes('likely')) {
        return 3; // 良性
      } else if (lowerClass.includes('likely benign') || lowerClass.includes('likely_benign')) {
        return 4; // 可能良性
      } else if (lowerClass.includes('uncertain') || lowerClass.includes('significance')) {
        return 5; // 意义未明
      } else {
        return 6; // 其他
      }
    };
    
    // 按分类优先级排序变异
    const sortedVariants = [...variants].sort((a, b) => {
      const aPriority = getClassificationPriority(a.classification);
      const bPriority = getClassificationPriority(b.classification);
      
      // 优先级数字越小越优先
      return aPriority - bPriority;
    });
    
    // 返回前4个变异
    return sortedVariants.slice(0, 4);
  }

  const recentFindings = getTopFindings();

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-base sm:text-lg font-medium">{t("clinvarAnalysis")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="space-y-4 w-full overflow-hidden">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 w-full">
            <div className="bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400">{clinvarData.statistics.pathogenic}</div>
              <div className="text-xs text-red-600 dark:text-red-400 leading-tight break-words">{t("pathogenicVariants")}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {clinvarData.statistics.likely_pathogenic}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 leading-tight break-words">{t("likelyPathogenic")}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0 xs:col-span-2 sm:col-span-1">
              <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">{clinvarData.statistics.uncertain_significance}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 leading-tight break-words">{t("uncertainSignificance")}</div>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">{clinvarData.statistics.likely_benign}</div>
              <div className="text-xs text-teal-600 dark:text-teal-400 leading-tight break-words">{t("likelyBenign")}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-lg text-center min-w-0">
              <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{clinvarData.statistics.benign}</div>
              <div className="text-xs text-green-600 dark:text-green-400 leading-tight break-words">{t("benign")}</div>
            </div>
          </div>

          <div className="mt-4 w-full overflow-hidden">
            <h3 className="text-sm font-medium mb-2">{t("recentFindings")}</h3>
            <div className="space-y-2 w-full">
              {recentFindings.map((finding) => (
                <div key={finding.rsid} className="border rounded-md p-2 sm:p-3 w-full overflow-hidden">
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                      <div className="flex-shrink-0">
                        {getClassificationIcon(finding.clnsig)}
                      </div>
                      <span className="ml-2 font-medium text-sm truncate">{finding.gene}</span>
                    </div>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">{finding.rsid}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate w-full" title={finding.clndn}>
                    {finding.clndn}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground w-full">
            <span className="text-xs sm:text-sm truncate">
              {t("totalVariants")}: {Object.keys(clinvarData.data).length}
            </span>
            <Button variant="outline" size="sm" className="gap-1 text-foreground w-full sm:w-auto flex-shrink-0" asChild>
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
