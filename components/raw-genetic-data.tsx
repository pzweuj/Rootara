"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Copy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"

// 定义数据类型
interface SNPData {
  id: string
  rsid: string
  chromosome: string
  position: string
  genotype: string
  [key: string]: any
}

interface ApiResponse {
  data: { [key: string]: SNPData }
  columns: string[]
  pagination: {
    total: number
    page: number
    page_size: number
    total_pages: number
  }
}

interface RawGeneticDataProps {
  currentReportId: string
}

export function RawGeneticData({ currentReportId }: RawGeneticDataProps) {
  const { t, language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedChromosome, setSelectedChromosome] = useState("all")
  const [snpData, setSnpData] = useState<SNPData[]>([])
  const [metadata, setMetadata] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    page_size: 15,
    total_pages: 0
  })
  
  // 预设染色体列表，包含chr1-chr22, chrX, chrY和MT
  const chromosomes = [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", 
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", 
    "21", "22", "X", "Y", "MT"
  ];

  // 获取数据的函数
  const fetchData = async () => {
    if (!currentReportId) return

    setLoading(true)
    setError(null)

    try {
      const requestBody = {
        report_id: currentReportId,
        page_size: pagination.page_size,
        page: pagination.page,
        sort_by: "",
        sort_order: "asc",
        search_term: searchQuery || "",
        filters: selectedChromosome !== "all" ? { chromosome: selectedChromosome } : {}
      };

      const response = await fetch('/api/report/table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API响应错误:", response.status, errorText);
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("API返回数据:", result);
      
      // 安全处理数据
      if (!result.data) {
        console.error("API返回数据格式不正确:", result);
        throw new Error("API返回数据格式不正确");
      }
      
      // 转换数据格式 - 使用更安全的方式处理数据
      let dataArray: SNPData[] = [];
      
      // 检查数据类型并相应处理
      if (Array.isArray(result.data)) {
        // 如果是数组，直接使用
        dataArray = result.data.map((item: any) => ({
          id: item.id || item.rsid || String(Math.random()),
          rsid: item.rsid || "",
          chromosome: item.chromosome || "",
          position: item.position || "",
          genotype: item.genotype || "",
          ...item
        }));
      } else if (typeof result.data === 'object' && result.data !== null) {
        // 如果是对象，转换为数组
        dataArray = Object.entries(result.data).map(([key, value]: [string, any]) => ({
          id: value.id || value.rsid || key,
          rsid: value.rsid || "",
          chromosome: value.chromosome || "",
          position: value.position || "",
          genotype: value.genotype || "",
          ...value
        }));
      }
      
      setSnpData(dataArray);
      
      // 安全处理分页信息
      if (result.pagination) {
        setPagination(result.pagination);
      }
      
      // 移除提取染色体的代码，使用预设的染色体列表
    } catch (err) {
      console.error("获取数据失败:", err);
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  // 当报告ID、页码、搜索条件或染色体筛选变化时获取数据
  useEffect(() => {
    fetchData()
  }, [currentReportId, pagination.page, searchQuery, selectedChromosome])

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 })) // 重置到第一页
    fetchData()
  }

  // 处理染色体选择
  const handleChromosomeChange = (value: string) => {
    setSelectedChromosome(value)
    setPagination(prev => ({ ...prev, page: 1 })) // 重置到第一页
  }

  const handleCopyRsid = (rsid: string) => {
    navigator.clipboard
      .writeText(rsid)
      .then(() => {
        console.log(`Copied ${rsid} to clipboard`)
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
      })
  }

  // 处理分页
  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }))
    }
  }

  const handleNextPage = () => {
    if (pagination.page < pagination.total_pages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }))
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold tracking-tight mb-4">{t("rawData") || "原始基因数据"}</h2>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="relative w-full md:w-2/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchByRsID") || "按rsID搜索..."}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
        <div className="w-full md:w-1/3">
          <Select value={selectedChromosome} onValueChange={handleChromosomeChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("chromosome") || "染色体"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allChromosomes") || "所有染色体"}</SelectItem>
              {chromosomes.map((chr) => (
                <SelectItem key={chr} value={chr}>
                  {chr === "MT" 
                    ? (language === "zh-CN" ? "线粒体" : "Mitochondria") 
                    : `${t("chromosome") || "染色体"} ${chr}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <p>{t("loading") || "加载中..."}</p>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center p-8 text-red-500">
              <p>{error}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">rsID</TableHead>
                    <TableHead className="text-center">{t("chromosome") || "染色体"}</TableHead>
                    <TableHead className="text-center">{t("position") || "位置"}</TableHead>
                    <TableHead className="text-center">{t("genotype") || "基因型"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snpData.length > 0 ? (
                    snpData.map((snp) => (
                      <TableRow key={snp.id}>
                        <TableCell className="font-medium text-center">{snp.rsid}</TableCell>
                        <TableCell className="text-center">{snp.chromosome}</TableCell>
                        <TableCell className="text-center">{snp.position}</TableCell>
                        <TableCell className="text-center">{snp.genotype}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        {t("noDataFound") || "未找到匹配的数据"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-muted-foreground">
          {t("showing") || "显示"} {snpData.length} {t("of") || "/"} {pagination.total} Variants
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrevPage}
            disabled={pagination.page <= 1 || loading}
          >
            {t("previous") || "上一页"}
          </Button>
          <span className="flex items-center px-2">
            {pagination.page} / {pagination.total_pages}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleNextPage}
            disabled={pagination.page >= pagination.total_pages || loading}
          >
            {t("next") || "下一页"}
          </Button>
        </div>
      </div>
    </div>
  )
}
