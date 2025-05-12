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
  const { language } = useLanguage()
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
      console.log("使用全局报告ID加载数据:", currentReportId)
      fetchClinvarData(currentReportId)
    }
  }, [currentReportId])

  const translations = {
    en: {
      clinvarAnalysis: "ClinVar Analysis",
      clinicalVariants: "Clinical Variants Analysis",
      exportData: "Export Data",
      shareResults: "Share Results",
      overview: "Overview",
      pathogenicVariants: "Pathogenic Variants",
      likelyPathogenic: "Likely Pathogenic",
      uncertainSignificance: "Uncertain Significance",
      likelyBenign: "Likely Benign",
      benign: "Benign",
      variantList: "Variant List",
      searchVariants: "Search variants...",
      classification: "Classification",
      allClassifications: "All Classifications",
      gene: "Gene",
      allGenes: "All Genes",
      variantId: "Variant ID",
      chromosome: "Chromosome",
      position: "Position",
      condition: "Condition",
      reviewStatus: "Review Status",
      lastUpdated: "Last Updated",
      noVariantsFound: "No variants found matching your criteria",
      totalVariants: "Total variants with ClinVar annotations",
      clinvarDescription:
        "ClinVar is a public database of reports of the relationships among human variations and phenotypes, with supporting evidence. Rootara filtered out insertions and deletions because gene chips may not accurately detect these types.",
      loading: "Loading data...",
      error: "Error loading data",
      retry: "Retry",
      page: "Page",
      of: "of",
      itemsPerPage: "Items per page",
      prev: "Previous",
      next: "Next",
      genotype: "Genotype",
    },
    "zh-CN": {
      clinvarAnalysis: "ClinVar 分析",
      clinicalVariants: "临床变异分析",
      exportData: "导出数据",
      shareResults: "分享结果",
      overview: "概览",
      pathogenicVariants: "致病变异",
      likelyPathogenic: "可能致病",
      uncertainSignificance: "意义不明确",
      likelyBenign: "可能良性",
      benign: "良性",
      variantList: "变异列表",
      searchVariants: "搜索变异...",
      classification: "分类",
      allClassifications: "所有分类",
      gene: "基因",
      allGenes: "所有基因",
      variantId: "变异ID",
      chromosome: "染色体",
      position: "位置",
      condition: "疾病",
      reviewStatus: "审查状态",
      lastUpdated: "最后更新",
      noVariantsFound: "未找到符合条件的变异",
      totalVariants: "存在Clinvar注释的总变异数",
      clinvarDescription: "ClinVar是一个公共数据库，报告人类变异与表型之间的关系，并提供支持证据。Rootara过滤了插入和缺失位点，因为基因芯片对该类型可能无法准确检测。",
      loading: "正在加载数据...",
      error: "加载数据出错",
      retry: "重试",
      page: "页",
      of: "共",
      itemsPerPage: "每页显示",
      prev: "上一页",
      next: "下一页",
      genotype: "基因型",
    },
  }

  const t = (key: string) => {
    return (
      translations[language as keyof typeof translations][key as keyof (typeof translations)[typeof language]] || key
    )
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

  // 中英文文本映射
  const texts = {
    title: {
      en: "Health Risks",
      zh: "健康风险",
    },
    subtitle: {
      en: "Explore your genetic health predispositions",
      zh: "探索您的基因健康倾向",
    },
    notice: {
      title: {
        en: "Important Notice",
        zh: "重要提示",
      },
      content: {
        en: "Genetic testing is not a diagnostic tool. Always consult with a healthcare professional before making any medical decisions based on these results.",
        zh: "基因检测不是诊断工具。在根据这些结果做出任何医疗决定之前，请务必咨询医疗专业人士。",
      },
    },
    tabs: {
      overview: {
        en: "Overview",
        zh: "概览",
      },
      hereditary: {
        en: "Hereditary Diseases",
        zh: "遗传疾病",
      },
      drugs: {
        en: "Drug Responses",
        zh: "药物反应",
      },
      carrier: {
        en: "Carrier Status",
        zh: "携带者状态",
      },
    },
    understanding: {
      title: {
        en: "Understanding Health Risks",
        zh: "了解健康风险",
      },
      description: {
        en: "Your genetic health risks are calculated based on specific genetic variants associated with various conditions.",
        zh: "您的基因健康风险是根据与各种疾病相关的特定基因变异计算的。",
      },
      risks: {
        elevated: {
          en: "Elevated Risk",
          zh: "风险升高",
        },
        slightlyElevated: {
          en: "Slightly Elevated Risk",
          zh: "略微升高风险",
        },
        average: {
          en: "Average Risk",
          zh: "平均风险",
        },
        reduced: {
          en: "Reduced Risk",
          zh: "风险降低",
        },
      },
    },
    hereditary: {
      title: {
        en: "Hereditary Disease Risk Factors",
        zh: "遗传疾病风险因素",
      },
      description: {
        en: "Genetic variants associated with hereditary conditions",
        zh: "与遗传性疾病相关的基因变异",
      },
      geneticVariants: {
        en: "Genetic Variants:",
        zh: "基因变异:",
      },
      gene: {
        en: "Gene",
        zh: "基因",
      },
      variant: {
        en: "Variant",
        zh: "变异",
      },
      genotype: {
        en: "Your Genotype",
        zh: "您的基因型",
      },
      risk: {
        en: "Risk",
        zh: "风险",
      },
    },
    drugs: {
      title: {
        en: "Drug Response Genetics",
        zh: "药物反应基因学",
      },
      description: {
        en: "How your genetics may affect your response to medications",
        zh: "您的基因如何影响您对药物的反应",
      },
      relevantGenes: {
        en: "Relevant Genes:",
        zh: "相关基因:",
      },
    },
    carrier: {
      title: {
        en: "Carrier Status",
        zh: "携带者状态",
      },
      description: {
        en: "Genetic variants that could be passed to your children",
        zh: "可能传递给您子女的基因变异",
      },
      gene: {
        en: "Gene:",
        zh: "基因:",
      },
      variants: {
        en: "Variants:",
        zh: "变异:",
      },
    },
    learnMore: {
      en: "Learn More",
      zh: "了解更多",
    },
  }

  return (
    <div className="space-y-6">
      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="flex items-start space-x-4 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              {texts.notice.title[language === "en" ? "en" : "zh"]}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {texts.notice.content[language === "en" ? "en" : "zh"]}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("clinvarAnalysis")}</CardTitle>
          <CardDescription>{t("clinvarDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{variantStatistics.pathogenic}</div>
                <div className="text-sm text-red-600 dark:text-red-400">{t("pathogenicVariants")}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {variantStatistics.likely_pathogenic}
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-400">{t("likelyPathogenic")}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{variantStatistics.uncertain_significance}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">{t("uncertainSignificance")}</div>
              </CardContent>
            </Card>
            <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">{variantStatistics.likely_benign}</div>
                <div className="text-sm text-teal-600 dark:text-teal-400">{t("likelyBenign")}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{variantStatistics.benign}</div>
                <div className="text-sm text-green-600 dark:text-green-400">{t("benign")}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative w-full md:w-2/3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchVariants")}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full md:w-1/3">
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger>
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

        <Card>
          <CardContent className="p-0">
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
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      {t("noVariantsFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* 分页控件 */}
        {filteredVariants.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 mt-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {t("itemsPerPage")}:
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
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
            
            <div className="flex items-center space-x-6">
              <div className="text-sm text-muted-foreground">
                {t("page")} {currentPage} {t("of")} {Math.ceil(filteredVariants.length / itemsPerPage)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label={t("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === Math.ceil(filteredVariants.length / itemsPerPage)}
                  aria-label={t("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {t("totalVariants")}: {Object.keys(clinvarData.data).length}
        </p>
      </div>
    </div>
  )
}
