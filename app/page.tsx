"use client"

import { useEffect, useState } from "react"
import { GeneticProfileOverview } from "@/components/genetic-profile-overview"
import { TraitHighlights } from "@/components/trait-highlights"
import { ClinvarSummary } from "@/components/clinvar-summary"
import { useLanguage } from "@/contexts/language-context"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import dynamic from 'next/dynamic'

export default function Dashboard() {
  const { t } = useLanguage()
  const [refreshKey, setRefreshKey] = useState(0)

  // 页面加载时自动刷新所有模块
  useEffect(() => {
    // 页面初次加载时触发刷新
    setRefreshKey(prevKey => prevKey + 1)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("geneticDashboard")}</h1>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        <GeneticProfileOverview key={`genetic-overview-${refreshKey}`} />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        <TraitHighlights key={`trait-highlights-${refreshKey}`} />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        <ClinvarSummary key={`clinvar-summary-${refreshKey}`} />
      </div>
    </div>
  )
}
