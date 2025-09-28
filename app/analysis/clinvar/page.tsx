"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { Button } from "@/components/ui/button"
import { useReport } from "@/contexts/report-context" // 导入报告上下文

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

// 添加防抖函数
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ClinvarAnalysisPage() {
  const { language, t } = useLanguage()
  const { currentReportId } = useReport() // 使用报告上下文获取当前报告ID
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("") // 用于存储防抖后的搜索词
  const [classificationFilter, setClassificationFilter] = useState("all")
  const [geneFilter, setGeneFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [clinvarData, setClinvarData] = useState<ClinVarResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [statistics, setStatistics] = useState({
    pathogenic: 0,
    likely_pathogenic: 0,
    benign: 0,
    likely_benign: 0,
    uncertain_significance: 0
  })

  // 使用防抖处理搜索查询
  const debouncedQuery = useDebounce(searchQuery, 300);

  // 当防抖查询变化时更新搜索结果
  useEffect(() => {
    setDebouncedSearchQuery(debouncedQuery);
  }, [debouncedQuery]);

  // 获取ClinVar数据的函数
  const fetchClinvarData = async (reportId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // 修改为调用新的API路由
      const response = await fetch(`/api/report/clinvar`, {
        method: 'POST',
        headers: {
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
      console.log("使用全局报告ID加载数据:", currentReportId)
      fetchClinvarData(currentReportId)
    }
  }, [currentReportId])

  // Local translations for ClinVar-specific terms not in global context
  const localTranslations = {
    en: {
      clinicalVariants: "Clinical Variants Analysis",
      exportData: "Export Data",
      shareResults: "Share Results",
      overview: "Overview",
      variantList: "Variant List",
      allGenes: "All Genes",
      reviewStatus: "Review Status",
      lastUpdated: "Last Updated",
      totalVariants: "Total variants with ClinVar annotations",
    },
    "zh-CN": {
      clinicalVariants: "临床变异分析",
      exportData: "导出数据",
      shareResults: "分享结果",
      overview: "概览",
      variantList: "变异列表",
      allGenes: "所有基因",
      reviewStatus: "审查状态",
      lastUpdated: "最后更新",
      totalVariants: "存在Clinvar注释的总变异数",
    },
  }

  const localT = (key: keyof (typeof localTranslations)["en"]) => {
    return localTranslations[language][key] || key
  }

  const normalizeClassification = (classification: string) => {
    const lowerClass = classification.toLowerCase();
    
    // 如果包含多个分类（用/分隔），按优先级选择一个
    if (lowerClass.includes('/')) {
      if (lowerClass.includes('pathogenic')) return 'pathogenic';
      if (lowerClass.includes('likely pathogenic')) return 'likely pathogenic';
      if (lowerClass.includes('benign')) return 'benign';
      if (lowerClass.includes('likely benign')) return 'likely benign';
      if (lowerClass.includes('uncertain_significance') || lowerClass.includes('uncertain significance')) return 'uncertain significance';
      return lowerClass.split('/')[0].trim(); // 如果没有匹配到优先级，返回第一个
    }
    
    return lowerClass.replace(/_/g, ' ');
  }

  // 根据API返回的分类获取对应的Badge
  const getClassificationBadge = (classification: string) => {
    // 将API返回的分类映射到UI显示的分类
    const normalizedClassification = normalizeClassification(classification);
  
    switch (normalizedClassification) {
      case "pathogenic":
        return (
          <Badge
            variant="outline"
            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            {t("pathogenicVariants")}
          </Badge>
        )
      case "likely pathogenic":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t("likelyPathogenic")}
          </Badge>
        )
      case "uncertain significance":
      case "uncertain_significance":
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800"
          >
            <Info className="h-3 w-3 mr-1" />
            {t("uncertainSignificance")}
          </Badge>
        )
      case "likely benign":
        return (
          <Badge
            variant="outline"
            className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800"
          >
            <Info className="h-3 w-3 mr-1" />
            {t("likelyBenign")}
          </Badge>
        )
      case "benign":
        return (
          <Badge
            variant="outline"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {t("benign")}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            {classification}
          </Badge>
        )
    }
  }

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">{t("loading")}</span>
      </div>
    )
  }

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="mt-2 text-red-500">{t("error")}: {error}</p>
        <button 
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          onClick={() => fetchClinvarData(currentReportId)}
        >
          {t("retry")}
        </button>
      </div>
    )
  }

  // 如果没有数据，显示空状态
  if (!clinvarData) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>{t("noVariantsFound")}</p>
      </div>
    )
  }

  // 将API返回的数据转换为数组形式，方便处理
  const variants = Object.entries(clinvarData.data).map(([rsid, variant]) => ({
    id: rsid,
    ...variant,
    // 将API返回的clnsig映射到UI显示的classification
    classification: variant.clnsig.replace(/_/g, ' '),
    // 将API返回的clndn映射到UI显示的condition
    condition: variant.clndn.replace(/_/g, ' ')
  }))

  // 获取所有基因的唯一列表
  const uniqueGenes = Array.from(new Set(variants.map((variant) => variant.gene))).sort()

  // 计算各个分类的数量
  const calculateStatistics = () => {
    const stats = {
      pathogenic: 0,
      likely_pathogenic: 0,
      benign: 0,
      likely_benign: 0,
      uncertain_significance: 0
    };

    variants.forEach(variant => {
      const normalizedClass = normalizeClassification(variant.classification);
      
      switch(normalizedClass) {
        case 'pathogenic':
          stats.pathogenic += 1;
          break;
        case 'likely pathogenic':
          stats.likely_pathogenic += 1;
          break;
        case 'benign':
          stats.benign += 1;
          break;
        case 'likely benign':
          stats.likely_benign += 1;
          break;
        case 'uncertain significance':
          stats.uncertain_significance += 1;
          break;
      }
    });

    return stats;
  };

  // 计算统计数据
  const variantStatistics = calculateStatistics();

  // 过滤变异
  const filteredVariants = variants.filter((variant) => {
    const matchesSearch =
      debouncedSearchQuery === "" || // 如果搜索词为空，显示所有结果
      variant.id.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      variant.gene.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      variant.condition.toLowerCase().includes(debouncedSearchQuery.toLowerCase())

    const normalizedClassification = normalizeClassification(variant.classification);

    const matchesClassification =
      classificationFilter === "all" ||
      (classificationFilter === "pathogenic" && normalizedClassification === "pathogenic") ||
      (classificationFilter === "likely_pathogenic" && normalizedClassification === "likely pathogenic") ||
      (classificationFilter === "uncertain" && normalizedClassification.includes("uncertain")) ||
      (classificationFilter === "likely_benign" && normalizedClassification === "likely benign") ||
      (classificationFilter === "benign" && normalizedClassification === "benign")

    return matchesSearch && matchesClassification
  })

  // 计算分页 - 获取当前页的数据
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredVariants.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredVariants.length / itemsPerPage)



  return (
    <div className="space-y-4 sm:space-y-6 w-full overflow-hidden">
      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="flex items-start space-x-3 sm:space-x-4 py-3 sm:py-4">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-300 text-sm sm:text-base">
              {t("clinvarNoticeTitle")}
            </p>
            <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-400 break-words">
              {t("clinvarNoticeContent")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full overflow-hidden">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg sm:text-xl">{t("clinvarAnalysis")}</CardTitle>
            <Badge variant="outline" className="text-xs font-mono self-start sm:self-center">
              {t("reportId")}
              {currentReportId}
            </Badge>
          </div>
          <CardDescription className="text-sm break-words">{t("clinvarDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{variantStatistics.pathogenic}</div>
                <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 leading-tight">{t("pathogenicVariants")}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {variantStatistics.likely_pathogenic}
                </div>
                <div className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 leading-tight">{t("likelyPathogenic")}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 col-span-2 sm:col-span-1">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{variantStatistics.uncertain_significance}</div>
                <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 leading-tight">{t("uncertainSignificance")}</div>
              </CardContent>
            </Card>
            <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-teal-600 dark:text-teal-400">{variantStatistics.likely_benign}</div>
                <div className="text-xs sm:text-sm text-teal-600 dark:text-teal-400 leading-tight">{t("likelyBenign")}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{variantStatistics.benign}</div>
                <div className="text-xs sm:text-sm text-green-600 dark:text-green-400 leading-tight">{t("benign")}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 sm:mt-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <div className="relative w-full sm:w-2/3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchVariants")}
              className="pl-8 text-sm sm:text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-1/3">
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger className="text-sm sm:text-base">
                <SelectValue placeholder={t("classification")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allClassifications")}</SelectItem>
                <SelectItem value="pathogenic">{t("pathogenicVariants")}</SelectItem>
                <SelectItem value="likely_pathogenic">{t("likelyPathogenic")}</SelectItem>
                <SelectItem value="uncertain">{t("uncertainSignificance")}</SelectItem>
                <SelectItem value="likely_benign">{t("likelyBenign")}</SelectItem>
                <SelectItem value="benign">{t("benign")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="w-full overflow-hidden">
          <CardContent className="p-0">
            {/* 桌面端表格视图 */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[12%]">{t("gene")}</TableHead>
                    <TableHead className="w-[15%]">{t("variantId")}</TableHead>
                    <TableHead className="w-[8%]">{t("chromosome")}</TableHead>
                    <TableHead className="w-[10%]">{t("position")}</TableHead>
                    <TableHead className="w-[10%]">{t("genotype")}</TableHead>
                    <TableHead className="w-[30%]">{t("condition")}</TableHead>
                    <TableHead className="w-[20%]">{t("classification")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.length > 0 ? (
                    currentItems.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">{variant.gene}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          <a
                            href={`https://www.ncbi.nlm.nih.gov/snp/${variant.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:underline"
                            title={variant.id}
                          >
                            {variant.id}
                            <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell>{variant.chromosome}</TableCell>
                        <TableCell>{variant.position}</TableCell>
                        <TableCell>{variant.gt}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={variant.condition}>
                          {variant.condition}
                        </TableCell>
                        <TableCell>{getClassificationBadge(variant.classification)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        {t("noVariantsFound")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 移动端卡片视图 */}
            <div className="lg:hidden">
              {currentItems.length > 0 ? (
                <div className="space-y-3 p-4">
                  {currentItems.map((variant) => (
                    <Card key={variant.id} className="border border-border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{variant.gene}</div>
                            <a
                              href={`https://www.ncbi.nlm.nih.gov/snp/${variant.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:underline text-sm"
                              title={variant.id}
                            >
                              {variant.id}
                              <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                            </a>
                          </div>
                          <div className="flex-shrink-0">
                            {getClassificationBadge(variant.classification)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">{t("chromosome")}:</span>
                            <span className="ml-1">{variant.chromosome}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("position")}:</span>
                            <span className="ml-1">{variant.position}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("genotype")}:</span>
                            <span className="ml-1">{variant.gt}</span>
                          </div>
                        </div>

                        <div className="text-xs">
                          <span className="text-muted-foreground">{t("condition")}:</span>
                          <p className="mt-1 break-words">{variant.condition}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("noVariantsFound")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* 分页控件 */}
        {filteredVariants.length > 0 && (
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mt-4 px-4 sm:px-0">
            <div className="flex items-center justify-center sm:justify-start space-x-2">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {t("itemsPerPage")}:
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[60px] sm:w-[70px] text-xs sm:text-sm">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
              <div className="text-xs sm:text-sm text-muted-foreground text-center">
                {t("page")} {currentPage} {t("of")} {Math.ceil(filteredVariants.length / itemsPerPage)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label={t("prev")}
                  className="h-8 px-2 sm:px-3"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline ml-1">{t("prev")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === Math.ceil(filteredVariants.length / itemsPerPage)}
                  aria-label={t("next")}
                  className="h-8 px-2 sm:px-3"
                >
                  <span className="hidden sm:inline mr-1">{t("next")}</span>
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center sm:justify-between items-center px-4 sm:px-0">
        <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          {t("totalVariants")}: {Object.keys(clinvarData.data).length}
        </p>
      </div>
    </div>
  )
}
