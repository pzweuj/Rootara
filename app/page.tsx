"use client"

import { useEffect, useState } from "react"

import { ClinvarSummary } from "@/components/clinvar-summary"
import { GeneticProfileOverview } from "@/components/genetic-profile-overview"
import { TraitHighlights } from "@/components/trait-highlights"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context"
import { cachedDashboard, loadDashboard } from "@/lib/dashboard-cache"

function ReportDashboard({ id }: { id: string }) {
  const { t } = useLanguage()
  const [data, setData] = useState(() => cachedDashboard(id)?.value)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadDashboard(id)
      .then((value) => {
        if (active) {
          setData(value)
        }
      })
      .catch((error) => {
        if (active) {
          setError(String(error))
        }
      })
    return () => {
      active = false
    }
  }, [id, attempt])
  if (error) {
    return (
      <p role="alert">
        {error}{" "}
        <button
          onClick={() => {
            setError("")
            setAttempt((n) => n + 1)
          }}
        >
          {t("retry")}
        </button>
      </p>
    )
  }
  if (!data) {
    return <p role="status">{t("loading")}</p>
  }
  return (
    <>
      <GeneticProfileOverview currentReportId={id} {...data} />
      <TraitHighlights traits={data.traits} />
      <ClinvarSummary clinvarData={data.clinvar} />
    </>
  )
}

export default function Dashboard() {
  const { t } = useLanguage()
  const { currentReportId } = useReport()
  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
        {t("geneticDashboard")}
      </h1>
      {currentReportId && (
        <ReportDashboard key={currentReportId} id={currentReportId} />
      )}
    </div>
  )
}
