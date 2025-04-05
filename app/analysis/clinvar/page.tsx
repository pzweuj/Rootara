"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Share2, Search, AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

// 模拟 ClinVar 数据
const clinvarData = {
  totalVariants: 42,
  pathogenic: 3,
  likelyPathogenic: 5,
  uncertain: 18,
  likelyBenign: 9,
  benign: 7,
  variants: [
    {
      id: "rs28897696",
      gene: "BRCA2",
      chromosome: "13",
      position: "32911110",
      condition: "Hereditary breast and ovarian cancer syndrome",
      classification: "Pathogenic",
      reviewStatus: "Reviewed by expert panel",
      lastUpdated: "2023-05-12",
    },
    {
      id: "rs80357711",
      gene: "BRCA1",
      chromosome: "17",
      position: "41245466",
      condition: "Hereditary breast and ovarian cancer syndrome",
      classification: "Likely pathogenic",
      reviewStatus: "Criteria provided, single submitter",
      lastUpdated: "2023-04-18",
    },
    {
      id: "rs121908311",
      gene: "APOE",
      chromosome: "19",
      position: "44908684",
      condition: "Alzheimer's disease (late onset), susceptibility to",
      classification: "Risk factor",
      reviewStatus: "Reviewed by expert panel",
      lastUpdated: "2023-06-22",
    },
    {
      id: "rs397507444",
      gene: "CFTR",
      chromosome: "7",
      position: "117188683",
      condition: "Cystic fibrosis",
      classification: "Pathogenic",
      reviewStatus: "Reviewed by expert panel",
      lastUpdated: "2023-03-05",
    },
    {
      id: "rs886041500",
      gene: "PTEN",
      chromosome: "10",
      position: "87933147",
      condition: "Cowden syndrome 1",
      classification: "Likely pathogenic",
      reviewStatus: "Criteria provided, multiple submitters, no conflicts",
      lastUpdated: "2023-02-14",
    },
    {
      id: "rs587776649",
      gene: "TP53",
      chromosome: "17",
      position: "7675088",
      condition: "Li-Fraumeni syndrome",
      classification: "Pathogenic",
      reviewStatus: "Reviewed by expert panel",
      lastUpdated: "2023-01-30",
    },
    {
      id: "rs1555089353",
      gene: "MLH1",
      chromosome: "3",
      position: "37038108",
      condition: "Lynch syndrome",
      classification: "Likely pathogenic",
      reviewStatus: "Criteria provided, single submitter",
      lastUpdated: "2023-07-08",
    },
    {
      id: "rs1060500558",
      gene: "MYBPC3",
      chromosome: "11",
      position: "47355301",
      condition: "Hypertrophic cardiomyopathy",
      classification: "Uncertain significance",
      reviewStatus: "Criteria provided, single submitter",
      lastUpdated: "2023-06-15",
    },
    {
      id: "rs1554247743",
      gene: "LDLR",
      chromosome: "19",
      position: "11210912",
      condition: "Familial hypercholesterolemia",
      classification: "Likely pathogenic",
      reviewStatus: "Criteria provided, multiple submitters, no conflicts",
      lastUpdated: "2023-05-27",
    },
    {
      id: "rs1553118362",
      gene: "PKD1",
      chromosome: "16",
      position: "2139814",
      condition: "Polycystic kidney disease",
      classification: "Uncertain significance",
      reviewStatus: "Criteria provided, single submitter",
      lastUpdated: "2023-04-03",
    },
  ],
}

export default function ClinvarAnalysisPage() {
  const { language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")
  const [classificationFilter, setClassificationFilter] = useState("all")
  const [geneFilter, setGeneFilter] = useState("all")

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
      totalVariants: "Total Variants Analyzed",
      clinvarDescription:
        "ClinVar is a public database of reports of the relationships among human variations and phenotypes, with supporting evidence.",
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
      totalVariants: "分析的总变异数",
      clinvarDescription: "ClinVar是一个公共数据库，报告人类变异与表型之间的关系，并提供支持证据。",
    },
  }

  const t = (key: string) => {
    return translations[language as keyof typeof translations][key as keyof (typeof translations)[typeof language]] || key
  }

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case "Pathogenic":
        return (
          <Badge
            variant="outline"
            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            {t("pathogenicVariants")}
          </Badge>
        )
      case "Likely pathogenic":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t("likelyPathogenic")}
          </Badge>
        )
      case "Uncertain significance":
      case "Risk factor":
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800"
          >
            <Info className="h-3 w-3 mr-1" />
            {t("uncertainSignificance")}
          </Badge>
        )
      case "Likely benign":
        return (
          <Badge
            variant="outline"
            className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800"
          >
            <Info className="h-3 w-3 mr-1" />
            {t("likelyBenign")}
          </Badge>
        )
      case "Benign":
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

  // 获取所有基因的唯一列表
  const uniqueGenes = Array.from(new Set(clinvarData.variants.map((variant) => variant.gene))).sort()

  // 过滤变异
  const filteredVariants = clinvarData.variants.filter((variant) => {
    const matchesSearch =
      variant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variant.gene.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variant.condition.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesClassification =
      classificationFilter === "all" ||
      (classificationFilter === "pathogenic" && variant.classification === "Pathogenic") ||
      (classificationFilter === "likely_pathogenic" && variant.classification === "Likely pathogenic") ||
      (classificationFilter === "uncertain" &&
        (variant.classification === "Uncertain significance" || variant.classification === "Risk factor")) ||
      (classificationFilter === "likely_benign" && variant.classification === "Likely benign") ||
      (classificationFilter === "benign" && variant.classification === "Benign")

    // 移除了基因筛选条件
    return matchesSearch && matchesClassification
  })

  // 删除这一行，它是一个孤立的表达式
  // const matchesGene = geneFilter === "all" || variant.gene === geneFilter

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("clinvarAnalysis")}</h1>
          <p className="text-muted-foreground">{t("clinicalVariants")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t("exportData")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("clinvarAnalysis")}</CardTitle>
          <CardDescription>{t("clinvarDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{clinvarData.pathogenic}</div>
                <div className="text-sm text-red-600 dark:text-red-400">{t("pathogenicVariants")}</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {clinvarData.likelyPathogenic}
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-400">{t("likelyPathogenic")}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{clinvarData.uncertain}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">{t("uncertainSignificance")}</div>
              </CardContent>
            </Card>
            <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                  {clinvarData.likelyBenign}
                </div>
                <div className="text-sm text-teal-600 dark:text-teal-400">{t("likelyBenign")}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{clinvarData.benign}</div>
                <div className="text-sm text-green-600 dark:text-green-400">{t("benign")}</div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Top Pathogenic Variants</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("gene")}</TableHead>
                  <TableHead>{t("variantId")}</TableHead>
                  <TableHead>{t("condition")}</TableHead>
                  <TableHead>{t("classification")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinvarData.variants
                  .filter((v) => v.classification === "Pathogenic")
                  .slice(0, 5)
                  .map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell className="font-medium">{variant.gene}</TableCell>
                      <TableCell>
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/clinvar/${variant.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:underline"
                        >
                          {variant.id}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>{variant.condition}</TableCell>
                      <TableCell>{getClassificationBadge(variant.classification)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
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
                  <TableHead>{t("gene")}</TableHead>
                  <TableHead>{t("variantId")}</TableHead>
                  <TableHead>{t("chromosome")}</TableHead>
                  <TableHead>{t("position")}</TableHead>
                  <TableHead>{t("condition")}</TableHead>
                  <TableHead>{t("classification")}</TableHead>
                  <TableHead>{t("reviewStatus")}</TableHead>
                  <TableHead>{t("lastUpdated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.length > 0 ? (
                  filteredVariants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell className="font-medium">{variant.gene}</TableCell>
                      <TableCell>
                        <a
                          href={`https://www.ncbi.nlm.nih.gov/clinvar/${variant.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:underline"
                        >
                          {variant.id}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>{variant.chromosome}</TableCell>
                      <TableCell>{variant.position}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={variant.condition}>
                        {variant.condition}
                      </TableCell>
                      <TableCell>{getClassificationBadge(variant.classification)}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={variant.reviewStatus}>
                        {variant.reviewStatus}
                      </TableCell>
                      <TableCell>{variant.lastUpdated}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                      {t("noVariantsFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {t("totalVariants")}: {clinvarData.totalVariants}
        </p>
      </div>
    </div>
  )
}

