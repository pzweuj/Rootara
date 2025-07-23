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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Edit,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter, usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { toast } from "@/components/ui/use-toast"
import { useReport } from "@/contexts/report-context" // 导入报告上下文

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

export function ReportSwitcher({
  defaultReportId,
  onReportChange,
}: ReportSwitcherProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { language, t } = useLanguage()
  const { currentReportId, setCurrentReportId } = useReport() // 使用报告上下文

  const [reports, setReports] = useState<Report[]>([])
  // const [loading, setLoading] = useState(true); // 移除 loading 状态
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "date" | "source">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // 添加删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<string | null>(null)

  // 添加名称修改对话框状态
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [reportToRename, setReportToRename] = useState<Report | null>(null)
  const [newReportName, setNewReportName] = useState("")
  const [newReportNameZh, setNewReportNameZh] = useState("")

  // Define handleDeleteReport function before it's used
  // 更新删除报告函数
  const handleDeleteReport = async (reportId: string) => {
    try {
      const response = await fetch('/api/report/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ report_id: reportId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete report');
      }
      // 添加调试信息
      console.log("执行删除操作，报告ID:", reportId);
      
      // 验证reportId是否有效，防止传入错误的路径
      if (!reportId || reportId.includes('/') || reportId.includes('\\')) {
        throw new Error(`无效的报告ID: ${reportId}`);
      }
      
      // 打印响应状态
      console.log("删除API响应状态:", response.status);
      
      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`)
      }

      // 更新报告列表
      setReports(reports.filter((report) => report.id !== reportId))

      // 如果删除的是当前选中的报告，选择另一个
      if (selectedReport && selectedReport.id === reportId) {
        const firstReport = reports.find((r) => r.id !== reportId)
        setSelectedReport(firstReport || null)
        if (firstReport && onReportChange) {
          onReportChange(firstReport.id)
        }
      }

    } catch (error) {
      console.error("Error deleting report:", error)

      // 显示错误通知
      toast({
        title: t("deleteFailed"),
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  // 添加删除确认对话框处理函数
  const openDeleteDialog = (reportId: string) => {
    // 验证reportId是否有效
    if (!reportId || reportId.includes('/') || reportId.includes('\\')) {
      toast({
        title: t("error"),
        description: t("invalidReportId"),
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    // 添加模板报告保护逻辑
    if (reportId === "RPT_TEMPLATE01") {
      toast({
        title: t("operationDenied"),
        description: t("cannotDeleteTemplate"),
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    // 添加调试信息，显示将要删除的reportId
    console.log("准备删除的报告ID:", reportId);
    toast({
      title: language === "zh-CN" ? "调试信息" : "Debug Info",
      description: `报告ID: ${reportId}`,
      duration: 5000,
    });
    
    setReportToDelete(reportId);
    setDeleteDialogOpen(true);
  }

  const confirmDelete = async () => {
    if (reportToDelete && !reportToDelete.includes('/') && !reportToDelete.includes('\\')) {
      // 添加模板报告保护逻辑
      if (reportToDelete === "RPT_TEMPLATE01") {
        toast({
          title: language === "zh-CN" ? "操作被拒绝" : "Operation Denied",
          description: language === "zh-CN" ? "不能删除模板报告" : "Cannot delete template report",
          variant: "destructive",
          duration: 5000,
        });
        setReportToDelete(null);
        setDeleteDialogOpen(false);
        return;
      }
      
      // 添加调试信息，显示确认删除的reportId
      console.log("确认删除的报告ID:", reportToDelete);
      toast({
        title: t("debugInfo"),
        description: `确认删除报告ID: ${reportToDelete}`,
        duration: 5000,
      });
      
      await handleDeleteReport(reportToDelete);
      setReportToDelete(null);
      setDeleteDialogOpen(false);
    } else {
      toast({
        title: t("error"),
        description: t("invalidReportId"),
        variant: "destructive",
        duration: 5000,
      });
    }
  }

  // 添加重命名报告函数
  const handleRenameReport = async () => {
    if (!reportToRename) return
    
    try {
      const response = await fetch('/api/report/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          report_id: reportToRename.id,
          new_name: newReportName,
          new_name_zh: newReportNameZh
        })
      });
  
      if (!response.ok) {
        throw new Error(`重命名失败: ${response.status}`)
      }
  
      // 更新报告列表
      setReports(
        reports.map((report) => {
          if (report.id === reportToRename.id) {
            return {
              ...report,
              name: newReportName,
              nameZh: newReportName, // 让nameZh跟随name的值
            }
          }
          return report
        }),
      )
  
      // 如果重命名的是当前选中的报告，更新选中的报告
      if (selectedReport && selectedReport.id === reportToRename.id) {
        setSelectedReport({
          ...selectedReport,
          name: newReportName,
          nameZh: newReportName, // 让nameZh跟随name的值
        })
      }
  
      // 显示成功通知
      toast({
        title: t("renameSuccessful"),
        description: t("reportNameUpdated"),
        duration: 3000,
      })
  
      // 关闭对话框
      setRenameDialogOpen(false)
      setReportToRename(null)
      setNewReportName("")
      setNewReportNameZh("")
    } catch (error) {
      console.error("Error renaming report:", error)
  
      // 显示错误通知
      toast({
        title: t("renameFailed"),
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  // 添加打开重命名对话框函数
  const openRenameDialog = (report: Report) => {
    setReportToRename(report)
    setNewReportName(report.name)
    setNewReportNameZh(report.nameZh) // 这行可以保留，但不再需要使用
    setRenameDialogOpen(true)
  }

  // 处理报告导出
  const handleExportReport = async (reportId: string) => {
    try {
      // 调用API导出原始数据
      const response = await fetch(`/api/report/${reportId}/rawdata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`导出失败: ${response.status}`)
      }

      // 获取响应数据
      const data = await response.blob()

      // 创建下载链接
      const url = window.URL.createObjectURL(data)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `report-${reportId}-rawdata.txt`)
      document.body.appendChild(link)

      // 触发下载
      link.click()

      // 清理
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)

    } catch (error) {
      console.error("导出报告时出错:", error)

      // 显示错误通知
      toast({
        title: "Export ERROR",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  // 从API获取报告数据
  useEffect(() => {
    const fetchReports = async () => {
      try {
        // setLoading(true); // 移除设置 loading 为 true
        const response = await fetch("/api/report/all", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();

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
          snpCount: item.snpCount,
        }));

        setReports(formattedReports);

        // 设置默认选中的报告
        let reportToSelect: Report | undefined;

        // 首先检查是否有指定的defaultReportId
        if (defaultReportId) {
          reportToSelect = formattedReports.find((r) => r.id === defaultReportId);
        }

        // 如果没有找到指定的报告，则检查全局上下文中的currentReportId
        if (!reportToSelect && currentReportId) {
          reportToSelect = formattedReports.find((r) => r.id === currentReportId);
        }

        // 如果仍然没有找到，则使用默认报告或第一个报告
        if (!reportToSelect) {
          reportToSelect = formattedReports.find((r) => r.isDefault) || formattedReports[0];
        }

        if (reportToSelect) {
          setSelectedReport(reportToSelect);
          // 更新全局上下文中的报告ID
          setCurrentReportId(reportToSelect.id);
        }

        // setLoading(false); // 移除设置 loading 为 false
      } catch (err) {
        console.error("获取报告失败:", err);
        setError(err instanceof Error ? err.message : "获取报告数据失败");
        // setLoading(false); // 移除设置 loading 为 false
      }
    };

    fetchReports();
  }, [defaultReportId, currentReportId, setCurrentReportId]);

  // 根据环境变量TZ格式化日期的函数
  const formatDateWithTimezone = (dateString: string): string => {
    try {
      // 获取环境变量中的时区，如果不存在则使用系统默认时区
      const timezone =
        typeof process !== "undefined" && process.env.TZ
          ? process.env.TZ
          : Intl.DateTimeFormat().resolvedOptions().timeZone

      // 创建日期对象
      const date = new Date(dateString)

      // 使用Intl.DateTimeFormat格式化日期，考虑时区
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
      }).format(date)
    } catch (error) {
      console.error("日期格式化错误:", error)
      // 如果格式化失败，回退到简单格式
      return new Date(dateString).toISOString().split("T")[0]
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
      snpCount: "Variants Count:",
      rename: "Rename",
      renameReport: "Rename Report",
      reportName: "Report Name",
      reportNameZh: "Report Name (Chinese)",
      cancel: "Cancel",
      save: "Save",
      deleteConfirmTitle: "Delete Report",
      deleteConfirmMessage: "Are you sure you want to delete this report? This action cannot be undone.",
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
      snpCount: "位点数量：",
      rename: "重命名",
      renameReport: "重命名报告",
      reportName: "报告名称",
      reportNameZh: "报告名称（中文）",
      cancel: "取消",
      save: "保存",
      deleteConfirmTitle: "删除报告",
      deleteConfirmMessage: "确定要删除此报告吗？此操作无法撤销。",
    },
  }



  // 处理设置默认报告
  const handleSetDefault = async (reportId: string) => {
    try {

      // 调用API设置默认报告
      const response = await fetch('/api/report/default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ report_id: reportId })
      });

      if (!response.ok) {
        throw new Error(`设置默认报告失败: ${response.status}`)
      }

      // 获取响应数据
      const data = await response.json()

      // 更新本地报告列表，将选中的报告设为默认
      setReports(
        reports.map((report) => ({
          ...report,
          isDefault: report.id === reportId,
        })),
      )

      // 显示成功通知
      toast({
        title: "设置成功",
        description: "报告已设为默认",
        duration: 3000,
      })
    } catch (error) {
      console.error("设置默认报告时出错:", error)

      // 显示错误通知
      toast({
        title: "设置失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  const handleSelectReport = (report: Report) => {
    // 移除临时加载状态，直接更新状态
    setSelectedReport(report);
    // 更新全局上下文中的报告ID
    setCurrentReportId(report.id);
    // 添加对 onReportChange 回调的调用
    if (onReportChange) {
      onReportChange(report.id);
    }
    
    // 显示切换成功的通知，而不是加载状态
    toast({
      title: t("reportSwitched"),
      description: `${t("currentlyViewing")}${language === "zh-CN" ? report.nameZh : report.name}`,
      duration: 2000,
    });
    
    // 重要：不要在这里使用 router.push() 或其他导致页面导航的方法
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
        return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      case "ancestry":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "wegene":
        return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  // 加载状态
  // if (loading) {
  //   return (
  //     <Card className="mb-6">
  //       <CardContent className="p-6">
  //         <div className="flex justify-center items-center h-40">
  //           <div className="text-center">
  //             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
  //             <p>{t("loading")}</p>
  //           </div>
  //         </div>
  //       </CardContent>
  //     </Card>
  //   )
  // }

  // 错误状态
  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-40">
            <div className="text-center">
              <p className="text-red-500 mb-4">
                {t("error")}: {error}
              </p>
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
                      <Star className="h-3 w-3 ml-1 fill-yellow-500 text-yellow-500" />
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
                    <DropdownMenuItem onClick={(e) => {
                      e.preventDefault();
                      handleSelectReport(selectedReport);
                      // 可以添加一个通知提示用户报告已切换
                      toast({
                        title: language === "zh-CN" ? "报告已切换" : "Report Switched",
                        description: language === "zh-CN" 
                          ? `当前查看: ${selectedReport.nameZh}` 
                          : `Now viewing: ${selectedReport.name}`,
                        duration: 3000,
                      });
                    }}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t("viewReport")}
                    </DropdownMenuItem>
                    {!selectedReport.isDefault && (
                      <DropdownMenuItem onClick={() => handleSetDefault(selectedReport.id)}>
                        <Star className="mr-2 h-4 w-4" />
                        {t("setAsDefault")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => openRenameDialog(selectedReport)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t("rename")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExportReport(selectedReport.id)}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("download")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation() // 防止触发报告选择
                        openDeleteDialog(selectedReport.id)
                      }}
                    >
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
                      onClick={(e) => {
                        e.preventDefault();
                        // 如果已经选中了这个报告，不做任何操作
                        if (selectedReport?.id === report.id) return;
                        
                        handleSelectReport(report);
                      }}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation(); // 阻止事件冒泡
                            handleSelectReport(report); // 或 selectedReport，取决于上下文
                            // 添加通知提示用户报告已切换
                            toast({
                              title: language === "zh-CN" ? "报告已切换" : "Report Switched",
                              description: language === "zh-CN" 
                                ? `当前查看: ${report.nameZh}` 
                                : `Now viewing: ${report.name}`,
                              duration: 3000,
                            });
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            {t("viewReport")}
                          </DropdownMenuItem>
                          {!report.isDefault && (
                            <DropdownMenuItem onClick={() => handleSetDefault(report.id)}>
                              <Star className="mr-2 h-4 w-4" />
                              {t("setAsDefault")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openRenameDialog(report)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t("rename")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleExportReport(report.id)}>
                            <Download className="mr-2 h-4 w-4" />
                            {t("download")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation() // 防止触发报告选择
                              openDeleteDialog(report.id)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameReport")}</DialogTitle>
            <DialogDescription>
              {t("enterNewReportName")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="reportName" className="text-right">
                {t("reportName")}
              </label>
              <Input
                id="reportName"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleRenameReport}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
