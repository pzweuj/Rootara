"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink, Loader2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context"
import Link from "next/link"

// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';

// API密钥
const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001";

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
  const { language } = useLanguage()
  const { currentReportId } = useReport()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clinvarData, setClinvarData] = useState<ClinVarResponse | null>(null)

  // 获取ClinVar数据的函数
  const fetchClinvarData = async (reportId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/report/clinvar`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          report_id: reportId,
          sort_by: "",
          sort_order: "asc",
          search_term: "",
          filters: {},
          indel: false
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
    if (currentReportId) {
      fetchClinvarData(currentReportId)
    }
  }, [currentReportId])

  const translations = {
    en: {
      clinvarAnalysis: "ClinVar Analysis",
      pathogenicVariants: "Pathogenic Variants",
      likelyPathogenic: "Likely Pathogenic",
      uncertainSignificance: "Uncertain Significance",
      likelyBenign: "Likely Benign",
      benign: "Benign",
      recentFindings: "Findings",
      viewDetails: "View Details",
      totalVariants: "Total Variants Analyzed",
      gene: "Gene",
      condition: "Condition",
      classification: "Classification",
      loading: "Loading data...",
      error: "Error loading data",
      noVariantsFound: "No variants found",
    },
    "zh-CN": {
      clinvarAnalysis: "ClinVar 分析",
      pathogenicVariants: "致病变异",
      likelyPathogenic: "可能致病",
      uncertainSignificance: "意义不明确",
      likelyBenign: "可能良性",
      benign: "良性",
      recentFindings: "发现",
      viewDetails: "查看详情",
      totalVariants: "分析的总变异数",
      gene: "基因",
      condition: "疾病",
      classification: "分类",
      loading: "正在加载数据...",
      error: "加载数据出错",
      noVariantsFound: "没有找到变异",
    },
  }

  const t = (key: keyof (typeof translations)[typeof language]) => {
    return translations[language][key] || key
  }

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
    // 按照优先级排序：致病 > 可能致病 > 其他
    const sortedVariants = [...variants].sort((a, b) => {
      const aClass = a.classification.toLowerCase();
      const bClass = b.classification.toLowerCase();
      
      if (aClass.includes('pathogenic') && !aClass.includes('likely') && 
          !(bClass.includes('pathogenic') && !bClass.includes('likely'))) {
        return -1;
      }
      if (bClass.includes('pathogenic') && !bClass.includes('likely') && 
          !(aClass.includes('pathogenic') && !aClass.includes('likely'))) {
        return 1;
      }
      if (aClass.includes('likely pathogenic') && !bClass.includes('likely pathogenic')) {
        return -1;
      }
      if (bClass.includes('likely pathogenic') && !aClass.includes('likely pathogenic')) {
        return 1;
      }
      return 0;
    });
    
    return sortedVariants.slice(0, 4);
  }

  const recentFindings = getTopFindings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t("clinvarAnalysis")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{clinvarData.statistics.pathogenic}</div>
              <div className="text-xs text-red-600 dark:text-red-400">{t("pathogenicVariants")}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {clinvarData.statistics.likely_pathogenic}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">{t("likelyPathogenic")}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{clinvarData.statistics.uncertain_significance}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">{t("uncertainSignificance")}</div>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-teal-600 dark:text-teal-400">{clinvarData.statistics.likely_benign}</div>
              <div className="text-xs text-teal-600 dark:text-teal-400">{t("likelyBenign")}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{clinvarData.statistics.benign}</div>
              <div className="text-xs text-green-600 dark:text-green-400">{t("benign")}</div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">{t("recentFindings")}</h3>
            <div className="space-y-2">
              {recentFindings.map((finding) => (
                <div key={finding.id} className="border rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getClassificationIcon(finding.classification)}
                      <span className="ml-2 font-medium text-sm">{finding.gene}</span>
                    </div>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{finding.id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate" title={finding.condition}>
                    {finding.condition}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              {t("totalVariants")}: {Object.keys(clinvarData.data).length}
            </span>
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href="/analysis/clinvar">
                {t("viewDetails")}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
