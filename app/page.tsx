"use client"

import { GeneticProfileOverview } from "@/components/genetic-profile-overview"
import { AncestryMap } from "@/components/ancestry-map"
import { HealthRiskSummary } from "@/components/health-risk-summary"
import { TraitHighlights } from "@/components/trait-highlights"
// import { ReportSwitcher } from "@/components/report-switcher"
import { ClinvarSummary } from "@/components/clinvar-summary"
import { useLanguage } from "@/contexts/language-context"

export default function Dashboard() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('geneticDashboard')}</h1>

      {/* <ReportSwitcher /> */}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        <GeneticProfileOverview />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        <AncestryMap />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <HealthRiskSummary />
        <ClinvarSummary />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        <TraitHighlights />
      </div>
    </div>
  )
}

