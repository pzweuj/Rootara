"use client"

import { useState } from "react"
import { ReportSwitcher } from "@/components/report-switcher"
import { useLanguage } from "@/contexts/language-context"
import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RawGeneticData } from "@/components/raw-genetic-data"

export default function ReportsPage() {
  const { t } = useLanguage()
  const [exportFormat, setExportFormat] = useState("csv")

  const handleExport = () => {
    console.log(`Exporting data in ${exportFormat} format`)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("myReports")}</h1>
        <div className="flex gap-2">
          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="格式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
              <SelectItem value="vcf">VCF</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            {t("exportData") || "导出"}
          </Button>
        </div>
      </div>

      {/* 设置 WeGene 报告为默认报告 */}
      <ReportSwitcher defaultReportId="RPT-5K9L2M" />

      {/* 引入原始基因数据组件 */}
      <RawGeneticData t={t} />
    </div>
  )
}

