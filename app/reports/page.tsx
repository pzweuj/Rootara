"use client"

import { useState } from "react"
import { ReportSwitcher } from "@/components/report-switcher"
import { useLanguage } from "@/contexts/language-context"
import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"
import { RawGeneticData } from "@/components/raw-genetic-data"

export default function ReportsPage() {
  const { t } = useLanguage()
  const [currentReportId, setCurrentReportId] = useState("RPT-5K9L2M")

  const handleExport = () => {
    console.log(`Exporting data for report ${currentReportId}`)
  }

  const handleReportChange = (reportId: string) => {
    setCurrentReportId(reportId)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("myReports")}</h1>
        {/* <div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            {t("exportData") || "导出数据"}
          </Button>
        </div> */}
      </div>

      {/* 设置 WeGene 报告为默认报告，并添加报告切换回调 */}
      <ReportSwitcher defaultReportId="RPT-5K9L2M" onReportChange={handleReportChange} />

      {/* 传递当前报告ID给原始数据组件 */}
      <RawGeneticData currentReportId={currentReportId} />
    </div>
  )
}

