"use client"

import { ReportSwitcher } from "@/components/report-switcher"
import { useLanguage } from "@/contexts/language-context"

export default function ReportsPage() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("myReports")}</h1>
      </div>

      {/* 设置 WeGene 报告为默认报告 */}
      <ReportSwitcher defaultReportId="RPT-5K9L2M" />
    </div>
  )
}

