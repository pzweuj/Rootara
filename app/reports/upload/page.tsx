"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"

export default function UploadReportPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")
  const [reportName, setReportName] = useState("")
  const [source, setSource] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  // 添加额外的翻译项
  const translations = {
    en: {
      uploadGeneticData: "Upload Genetic Data",
      uploadNewReport: "Upload New Report",
      uploadFromService: "Upload your genetic data file from a testing service",
      reportName: "Report Name",
      reportNamePlaceholder: "e.g., My Ancestry Analysis",
      dataSource: "Data Source",
      selectDataSource: "Select data source",
      dragDropFile: "Drag and drop your genetic data file or click to browse",
      supportedFormats: "Supported formats: 23andMe, AncestryDNA, WeGene, FTDNA",
      selectFile: "Select File",
      remove: "Remove",
      setAsDefault: "Set as default report",
      privateSecure:
        "Your genetic data is private and secure. We use industry-standard encryption to protect your information.",
      uploading: "Uploading your genetic data...",
      takeFewMinutes: "This may take a few minutes depending on file size",
      uploadComplete: "Upload Complete!",
      dataProcessing: "Your genetic data has been successfully uploaded and is now being processed.",
      viewMyReports: "View My Reports",
      uploadFailed: "Upload Failed",
      tryAgain: "Try Again",
      errorUploadingFile: "There was an error uploading your file. Please try again.",
      cancel: "Cancel",
      uploadReport: "Upload Report",
      supportedDataFormats: "Supported Data Formats",
      compatibleFormats: "Information about compatible genetic data formats",
      rawDataFiles: "Raw data files from 23andMe are typically in a tab-separated format (.txt).",
      downloadFrom23andMe: "Download from 23andMe: Account → Browse Raw Data → Download",
      ancestryDataFormat: "AncestryDNA provides raw data in a tab-separated format (.txt).",
      downloadFromAncestry: "Download from Ancestry: DNA → Settings → Download Raw DNA Data",
      wegeneDataFormat: "WeGene DNA data is available in CSV format (.csv).",
      downloadFromWeGene: "Download from WeGene: DNA → Manage DNA kits → Download",
      ftdnaDataFormat: "FTDNA provides raw data in CSV format (.csv).",
      downloadFromFTDNA: "Download from FTDNA: myDNA → Download Raw Data",
      importantNote: "Important Note",
      uncompressedFiles:
        "Files must be uncompressed before uploading. If your file is in a .zip or .gz format, please extract it first. Maximum file size is 50MB.",
    },
    "zh-CN": {
      uploadGeneticData: "上传基因数据",
      uploadNewReport: "上传新报告",
      uploadFromService: "从测试服务上传您的基因数据文件",
      reportName: "报告名称",
      reportNamePlaceholder: "例如：我的祖源分析",
      dataSource: "数据来源",
      selectDataSource: "选择数据来源",
      dragDropFile: "拖放您的基因数据文件或点击浏览",
      supportedFormats: "支持的格式：23andMe、AncestryDNA、WeGene、FTDNA",
      selectFile: "选择文件",
      remove: "移除",
      setAsDefault: "设为默认报告",
      privateSecure: "您的基因数据是私密且安全的。我们使用行业标准加密来保护您的信息。",
      uploading: "正在上传您的基因数据...",
      takeFewMinutes: "根据文件大小，这可能需要几分钟时间",
      uploadComplete: "上传完成！",
      dataProcessing: "您的基因数据已成功上传，正在处理中。",
      viewMyReports: "查看我的报告",
      uploadFailed: "上传失败",
      tryAgain: "重试",
      errorUploadingFile: "上传文件时出错。请重试。",
      cancel: "取消",
      uploadReport: "上传报告",
      supportedDataFormats: "支持的数据格式",
      compatibleFormats: "关于兼容基因数据格式的信息",
      rawDataFiles: "来自23andMe的原始数据文件通常为制表符分隔格式(.txt)。",
      downloadFrom23andMe: "从23andMe下载：账户 → 浏览原始数据 → 下载",
      ancestryDataFormat: "AncestryDNA提供制表符分隔格式(.txt)的原始数据。",
      downloadFromAncestry: "从Ancestry下载：DNA → 设置 → 下载原始DNA数据",
      wegeneDataFormat: "WeGene DNA数据以CSV格式(.csv)提供。",
      downloadFromWeGene: "从WeGene下载：DNA → 管理DNA套件 → 下载",
      ftdnaDataFormat: "FTDNA提供CSV格式(.csv)的原始数据。",
      downloadFromFTDNA: "从FTDNA下载：myDNA → 下载原始数据",
      importantNote: "重要提示",
      uncompressedFiles: "上传前文件必须解压缩。如果您的文件是.zip或.gz格式，请先解压。最大文件大小为50MB。",
    },
  }

  // 本地翻译函数，用于处理未在全局上下文中定义的翻译
  const localT = (key: string) => {
    return (
      translations[language as keyof typeof translations]?.[
        key as keyof (typeof translations)[keyof typeof translations]
      ] || key
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setFileName(file.name)

      // Auto-detect source based on file name (simplified example)
      if (file.name.toLowerCase().includes("23andme")) {
        setSource("23andMe")
      } else if (file.name.toLowerCase().includes("ancestry")) {
        setSource("AncestryDNA")
      } else if (file.name.toLowerCase().includes("wegene")) {
        setSource("WeGene")
      } else if (file.name.toLowerCase().includes("ftdna") || file.name.toLowerCase().includes("familytree")) {
        setSource("FamilyTreeDNA")
      }

      // Auto-generate report name based on file name
      const baseName = file.name.split(".")[0].replace(/[_-]/g, " ")
      setReportName(baseName)
    }
  }

  const simulateUpload = () => {
    if (!fileName) {
      return
    }

    setUploadState("uploading")
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploadState("success")
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    simulateUpload()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{localT("uploadGeneticData")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{localT("uploadNewReport")}</CardTitle>
          <CardDescription>{localT("uploadFromService")}</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadState === "idle" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="report-name">{localT("reportName")}</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder={localT("reportNamePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">{localT("dataSource")}</Label>
                <Select value={source} onValueChange={setSource} required>
                  <SelectTrigger id="source">
                    <SelectValue placeholder={localT("selectDataSource")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="23andMe">23andMe</SelectItem>
                    <SelectItem value="AncestryDNA">AncestryDNA</SelectItem>
                    <SelectItem value="WeGene">WeGene</SelectItem>
                    <SelectItem value="FamilyTreeDNA">FamilyTreeDNA</SelectItem>
                    <SelectItem value="Other">{localT("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">{localT("dragDropFile")}</p>
                <p className="text-xs text-muted-foreground mb-4">{localT("supportedFormats")}</p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".txt,.csv,.tsv"
                  onChange={handleFileChange}
                  required
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="mx-auto" type="button">
                    {localT("selectFile")}
                  </Button>
                </label>
              </div>

              {fileName && (
                <div className="flex items-center justify-between p-2 bg-secondary rounded-md">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[200px]">{fileName}</span>
                  </div>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setFileName("")}>
                    {localT("remove")}
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="default"
                  checked={isDefault}
                  onCheckedChange={(checked: boolean) => setIsDefault(checked)}
                />
                <Label htmlFor="default">{localT("setAsDefault")}</Label>
              </div>

              {/* <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {localT("privateSecure")}
                </p>
              </div> */}
            </form>
          )}

          {uploadState === "uploading" && (
            <div className="space-y-4">
              <div className="p-6 text-center">
                <p className="text-sm font-medium mb-4">{localT("uploading")}</p>
                <Progress value={progress} className="h-2 mb-4" />
                <p className="text-xs text-muted-foreground">{localT("takeFewMinutes")}</p>
              </div>
            </div>
          )}

          {uploadState === "success" && (
            <div className="space-y-4">
              <div className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-lg font-medium mb-2">{localT("uploadComplete")}</p>
                <p className="text-sm text-muted-foreground mb-4">{localT("dataProcessing")}</p>
                <Button onClick={() => router.push("/reports")}>{localT("viewMyReports")}</Button>
              </div>
            </div>
          )}

          {uploadState === "error" && (
            <div className="space-y-4">
              <div className="p-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-2" />
                <p className="text-lg font-medium mb-2">{localT("uploadFailed")}</p>
                <p className="text-sm text-muted-foreground mb-4">{localT("errorUploadingFile")}</p>
                <Button variant="outline" onClick={() => setUploadState("idle")}>
                  {localT("tryAgain")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        {uploadState === "idle" && (
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/reports")}>
              {localT("cancel")}
            </Button>
            <Button type="submit" onClick={handleSubmit} disabled={!fileName || !reportName || !source}>
              {localT("uploadReport")}
            </Button>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{localT("supportedDataFormats")}</CardTitle>
          <CardDescription>{localT("compatibleFormats")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">23andMe</h3>
                <p className="text-sm text-muted-foreground mb-2">{localT("rawDataFiles")}</p>
                <p className="text-xs text-muted-foreground">{localT("downloadFrom23andMe")}</p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">AncestryDNA</h3>
                <p className="text-sm text-muted-foreground mb-2">{localT("ancestryDataFormat")}</p>
                <p className="text-xs text-muted-foreground">{localT("downloadFromAncestry")}</p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">WeGene</h3>
                <p className="text-sm text-muted-foreground mb-2">{localT("wegeneDataFormat")}</p>
                <p className="text-xs text-muted-foreground">{localT("downloadFromWeGene")}</p>
              </div>

              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Family Tree DNA</h3>
                <p className="text-sm text-muted-foreground mb-2">{localT("ftdnaDataFormat")}</p>
                <p className="text-xs text-muted-foreground">{localT("downloadFromFTDNA")}</p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{localT("importantNote")}</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">{localT("uncompressedFiles")}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
