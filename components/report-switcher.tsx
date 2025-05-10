"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  Search,
  Star,
  MoreHorizontal,
  Check,
  SortAsc,
  SortDesc,
  Calendar,
  Download,
  Trash2,
  // 移除 FileDown 图标导入
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter, usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { toast } from "@/components/ui/use-toast";

// 定义报告接口
interface Report {
  id: string
  name: string
  nameZh: string
  uploadDate: string
  source: string
  isDefault: boolean
  user_id?: string
  extend?: string
  snpCount?: number
}

// 添加接口定义
interface ReportSwitcherProps {
  defaultReportId?: string
  onReportChange?: (reportId: string) => void
}

export function ReportSwitcher({ defaultReportId, onReportChange }: ReportSwitcherProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { language } = useLanguage()
  
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "date" | "source">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // 添加环境变量配置
  const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';
  const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001";

  // 处理报告导出
  const handleExportReport = async (reportId: string) => {
    try {
      // 显示加载状态或通知（可选）
      // toast({
      //   title: "正在导出报告...",
      //   description: "请稍候...",
      //   duration: 3000,
      // });

      // 调用API导出原始数据
      const response = await fetch(`${API_BASE_URL}/report/${reportId}/rawdata`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY
        },
        body: ''  // 空请求体，按照API要求
      });

      if (!response.ok) {
        throw new Error(`导出失败: ${response.status}`);
      }

      // 获取响应数据
      const data = await response.blob();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportId}-rawdata.txt`);
      document.body.appendChild(link);
      
      // 触发下载
      link.click();
      
      // 清理
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      // 显示成功通知
      // toast({
      //   title: "导出成功",
      //   description: "文件已下载",
      //   duration: 3000,
      // });
    } catch (error) {
      console.error("导出报告时出错:", error);
      
      // 显示错误通知
      toast({
        title: "Export ERROR",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 5000,
      });
    }
  };
  
  // 从API获取报告数据
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        const response = await fetch(API_BASE_URL + '/report/all', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'x-api-key': API_KEY
          },
          body: ''
        })
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`)
        }
        
        const data = await response.json()
        
        // 转换API返回的数据格式
        const formattedReports: Report[] = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          nameZh: item.nameZh,
          // 根据环境变量TZ格式化日期
          uploadDate: formatDateWithTimezone(item.uploadDate),
          source: item.source,
          isDefault: item.isDefault === 1,
          user_id: item.user_id,
          extend: item.extend,
          snpCount: item.snpCount
        }))
        
        setReports(formattedReports)
        
        // 设置默认选中的报告
        if (defaultReportId) {
          const defaultReport = formattedReports.find(r => r.id === defaultReportId)
          if (defaultReport) {
            setSelectedReport(defaultReport)
          } else {
            const firstDefault = formattedReports.find(r => r.isDefault)
            setSelectedReport(firstDefault || formattedReports[0])
          }
        } else {
          const firstDefault = formattedReports.find(r => r.isDefault)
          setSelectedReport(firstDefault || formattedReports[0])
        }
        
        setLoading(false)
      } catch (err) {
        console.error('获取报告失败:', err)
        setError(err instanceof Error ? err.message : '获取报告数据失败')
        setLoading(false)
      }
    }
    
    fetchReports()
  }, [defaultReportId])

  // 根据环境变量TZ格式化日期的函数
  const formatDateWithTimezone = (dateString: string): string => {
    try {
      // 获取环境变量中的时区，如果不存在则使用系统默认时区
      const timezone = typeof process !== 'undefined' && process.env.TZ 
        ? process.env.TZ 
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // 创建日期对象
      const date = new Date(dateString);
      
      // 使用Intl.DateTimeFormat格式化日期，考虑时区
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone
      }).format(date);
    } catch (error) {
      console.error('日期格式化错误:', error);
      // 如果格式化失败，回退到简单格式
      return new Date(dateString).toISOString().split('T')[0];
    }
  }

  const translations = {
    en: {
      myReports: "All Reports",
      uploadNewReport: "Upload New Report",
      searchReports: "Search reports...",
      allReports: "All Reports",
      sort: "Sort",
      sortBy: "Sort by",
      name: "Name",
      uploadDate: "Upload Date",
      source: "Source",
      ascending: "Ascending",
      descending: "Descending",
      reportId: "Report ID:",
      default: "Default",
      viewReport: "View Report",
      setAsDefault: "Set as Default",
      download: "Export",
      delete: "Delete",
      noReportsFound: "No reports found matching your criteria",
      loading: "Loading reports...",
      error: "Error loading reports",
      retry: "Retry",
      snpCount: "SNP Count:",
    },
    "zh-CN": {
      myReports: "所有报告",
      uploadNewReport: "上传新报告",
      searchReports: "搜索报告...",
      allReports: "所有报告",
      sort: "排序",
      sortBy: "排序方式",
      name: "名称",
      uploadDate: "上传日期",
      source: "来源",
      ascending: "升序",
      descending: "降序",
      reportId: "报告ID：",
      default: "默认",
      viewReport: "查看报告",
      setAsDefault: "设为默认",
      download: "导出",
      delete: "删除",
      noReportsFound: "未找到符合条件的报告",
      loading: "正在加载报告...",
      error: "加载报告时出错",
      retry: "重试",
      snpCount: "SNP数量：",
    },
  }

  const t = (key: keyof (typeof translations)["en"]) => {
    return translations[language][key] || key
  }

  // 处理设置默认报告
  const handleSetDefault = async (reportId: string) => {
    try {
      // 显示加载状态或通知（可选）
      // toast({
      //   title: t("settingDefault"),
      //   description: t("pleaseWait"),
      //   duration: 2000,
      // });

      // 调用API设置默认报告
      const response = await fetch(`${API_BASE_URL}/report/default?report_id=${reportId}`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY
        },
        body: '' // 空请求体，按照API要求
      });

      if (!response.ok) {
        throw new Error(`设置默认报告失败: ${response.status}`);
      }

      // 获取响应数据
      const data = await response.json();
      
      // 更新本地报告列表，将选中的报告设为默认
      setReports(reports.map(report => ({
        ...report,
        isDefault: report.id === reportId
      })));

      // 显示成功通知
      toast({
        title: "设置成功",
        description: "报告已设为默认",
        duration: 3000,
      });
    } catch (error) {
      console.error("设置默认报告时出错:", error);
      
      // 显示错误通知
      toast({
        title: "设置失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleSelectReport = (report: Report) => {
    setSelectedReport(report)
    // 添加对 onReportChange 回调的调用
    if (onReportChange) {
      onReportChange(report.id)
    }
    // In a real app, this would navigate to the report or update the context
  }

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  // Filter and sort reports
  const filteredReports = reports
    .filter((report) => {
      const matchesSearch =
        report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      } else if (sortBy === "date") {
        return sortOrder === "asc"
          ? new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
          : new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      } else {
        return sortOrder === "asc" ? a.source.localeCompare(b.source) : b.source.localeCompare(a.source)
      }
    })

  const getSourceBadgeColor = (source: string) => {
    switch (source.toLowerCase()) {
      case "23andme":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "ancestrydna":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "wegene":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "familytreedna":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  // 加载状态
  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-40">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
              <p>{t("loading")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-40">
            <div className="text-center">
              <p className="text-red-500 mb-4">{t("error")}: {error}</p>
              <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 没有报告
  if (reports.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">{t("myReports")}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push("/reports/upload")}>
              {t("uploadNewReport")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-40">
            <p>{t("noReportsFound")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">{t("myReports")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => router.push("/reports/upload")}>
            {t("uploadNewReport")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search and filter controls */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchReports")}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center">
                    {sortOrder === "asc" ? <SortAsc className="mr-2 h-4 w-4" /> : <SortDesc className="mr-2 h-4 w-4" />}
                    {t("sort")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortBy("name")
                      toggleSortOrder()
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${sortBy === "name" ? "opacity-100" : "opacity-0"}`} />
                    {t("name")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortBy("date")
                      toggleSortOrder()
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${sortBy === "date" ? "opacity-100" : "opacity-0"}`} />
                    {t("uploadDate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortBy("source")
                      toggleSortOrder()
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${sortBy === "source" ? "opacity-100" : "opacity-0"}`} />
                    {t("source")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleSortOrder}>
                    {sortOrder === "asc" ? t("ascending") : t("descending")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Currently selected report */}
          {selectedReport && (
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="text-lg font-medium">
                    {language === "zh-CN" ? selectedReport.nameZh : selectedReport.name}
                  </h3>
                  {selectedReport.isDefault && (
                    <Badge
                      variant="outline"
                      className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800"
                    >
                      <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                      {t("default")}
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push("/")}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t("viewReport")}
                    </DropdownMenuItem>
                    {!selectedReport.isDefault && (
                      <DropdownMenuItem onClick={() => handleSetDefault(selectedReport.id)}>
                        <Star className="mr-2 h-4 w-4" />
                        {t("setAsDefault")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExportReport(selectedReport.id)}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("download")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 dark:text-red-400">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("reportId")}</span>
                  <span className="ml-2 font-medium">{selectedReport.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("uploadDate")}</span>
                  <span className="ml-2 font-medium">{selectedReport.uploadDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("source")}</span>
                  <span className="ml-2">
                    <Badge className={getSourceBadgeColor(selectedReport.source)}>{selectedReport.source}</Badge>
                  </span>
                </div>
              </div>
              {selectedReport.snpCount && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">{t("snpCount")}</span>
                  <span className="ml-2 font-medium">{selectedReport.snpCount.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Report list */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[300px]">
              <div className="p-1">
                {filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-secondary/50 ${selectedReport?.id === report.id ? "bg-secondary" : ""}`}
                      onClick={() => handleSelectReport(report)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
                          <div className="truncate font-medium">
                            {language === "zh-CN" ? report.nameZh : report.name}
                          </div>
                          {report.isDefault && (
                            <Star className="h-3 w-3 ml-2 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center mt-1 text-xs text-muted-foreground">
                          <span className="truncate">{report.id}</span>
                          <span className="mx-2">•</span>
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>{report.uploadDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center ml-4">
                        <Badge className={`mr-2 ${getSourceBadgeColor(report.source)}`}>{report.source}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">{t("noReportsFound")}</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
