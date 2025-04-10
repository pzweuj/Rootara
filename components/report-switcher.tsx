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
  Filter,
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

// Sample report data
const sampleReports = [
  {
    id: "RPT-7A2B9C",
    name: "23andMe #1",
    nameZh: "23andMe #1",
    uploadDate: "2023-05-15",
    source: "23andMe",
    isDefault: true,
  },
  {
    id: "RPT-3F8D1E",
    name: "Health Screening #2",
    nameZh: "我的健康筛查 #2",
    uploadDate: "2023-06-22",
    source: "AncestryDNA",
    isDefault: false,
  },
  {
    id: "RPT-5K9L2M",
    name: "WeGene",
    nameZh: "微基因",
    uploadDate: "2023-07-10",
    source: "WeGene",
    isDefault: false,
  },
  {
    id: "RPT-4P7Q9R",
    name: "Test Name",
    nameZh: "测试名称",
    uploadDate: "2023-08-05",
    source: "FamilyTreeDNA",
    isDefault: false,
  },
]

// 添加接口定义
interface ReportSwitcherProps {
  defaultReportId?: string;
  onReportChange?: (reportId: string) => void;
}

export function ReportSwitcher({ defaultReportId, onReportChange }: ReportSwitcherProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { language } = useLanguage()
  
  // 初始化报告数据，如果提供了默认报告ID，则更新isDefault属性
  const initialReports = defaultReportId 
    ? sampleReports.map(report => ({
        ...report,
        isDefault: report.id === defaultReportId
      }))
    : sampleReports
  
  const [reports, setReports] = useState(initialReports)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "date" | "source">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  
  // 根据defaultReportId或isDefault属性选择默认报告
  const [selectedReport, setSelectedReport] = useState(() => {
    if (defaultReportId) {
      const report = reports.find(r => r.id === defaultReportId)
      if (report) return report
    }
    return reports.find(r => r.isDefault) || reports[0]
  })

  // 当defaultReportId变化时更新选中的报告
  useEffect(() => {
    if (defaultReportId) {
      const report = reports.find(r => r.id === defaultReportId)
      if (report) {
        setSelectedReport(report)
        // 更新所有报告的isDefault属性
        setReports(reports.map(r => ({
          ...r,
          isDefault: r.id === defaultReportId
        })))
      }
    }
  }, [defaultReportId])

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
      // 移除 exportData 翻译项
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
      // 移除 exportData 翻译项
    },
  }

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || key
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

  const handleSetDefault = (reportId: string) => {
    setReports(
      reports.map((report) => ({
        ...report,
        isDefault: report.id === reportId,
      })),
    )

    const newDefault = reports.find((r) => r.id === reportId)
    if (newDefault) {
      setSelectedReport(newDefault)
    }
  }

  const handleSelectReport = (report: typeof sampleReports[0]) => {
    setSelectedReport(report)
    // In a real app, this would navigate to the report or update the context
    // For now, we'll just update the selected report
  }

  // 移除 handleExportData 函数
  
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
  }

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "23andMe":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "AncestryDNA":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "WeGene":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "FamilyTreeDNA":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
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
              {/* 移除导出按钮，只保留下拉菜单 */}
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
                  <DropdownMenuItem>
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
            {/* 移除了Sharing Status相关内容 */}
          </div>

          {/* Report list */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[300px]">
              <div className="p-1">
                {filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-secondary/50 ${selectedReport.id === report.id ? "bg-secondary" : ""}`}
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
                        {/* 移除了共享状态图标 */}
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

