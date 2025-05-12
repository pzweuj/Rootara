"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface ReportContextType {
  currentReportId: string
  setCurrentReportId: (reportId: string) => void
}

const ReportContext = createContext<ReportContextType | undefined>(undefined)

export function useReport() {
  const context = useContext(ReportContext)
  if (!context) {
    throw new Error("useReport必须在ReportProvider内部使用")
  }
  return context
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [currentReportId, setCurrentReportId] = useState<string>("RPT_TEMPLATE01") // 默认报告ID

  // 从localStorage加载保存的报告ID
  useEffect(() => {
    const savedReportId = localStorage.getItem("currentReportId")
    if (savedReportId) {
      setCurrentReportId(savedReportId)
    }
  }, [])

  // 当报告ID变化时保存到localStorage
  useEffect(() => {
    localStorage.setItem("currentReportId", currentReportId)
  }, [currentReportId])

  return (
    <ReportContext.Provider value={{ currentReportId, setCurrentReportId }}>
      {children}
    </ReportContext.Provider>
  )
}