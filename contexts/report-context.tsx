"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"

import { useAuth } from "@/contexts/auth-context"

interface ReportContextType {
  currentReportId: string
  setCurrentReportId: (reportId: string) => void
  isLoading: boolean
}

interface Report {
  id: string
  isDefault: boolean
  // 其他报告属性...
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
  const [currentReportId, setCurrentReportId] = useState<string>("") // 初始为空字符串
  const [isLoading, setIsLoading] = useState<boolean>(true) // 添加加载状态

  const { user } = useAuth()

  // 从后端获取默认报告ID
  useEffect(() => {
    if (!user) {
      setCurrentReportId("")
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    const fetchDefaultReport = async () => {
      try {
        // 调用API获取所有报告
        const response = await fetch("/api/report/all", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: "",
        })

        if (!response.ok) {
          throw new Error("获取报告列表失败")
        }

        const data = await response.json()

        if (controller.signal.aborted) {
          return
        }
        const reports: Report[] = Array.isArray(data) ? data : []
        const savedId = localStorage.getItem("currentReportId")
        const selected =
          reports.find((report) => report.id === savedId) ??
          reports.find((report) => report.isDefault) ??
          reports[0]
        setCurrentReportId(selected?.id ?? "RPT_TEMPLATE01")
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error("获取默认报告错误:", error)
        // 出错时使用原来的默认值
        setCurrentReportId("RPT_TEMPLATE01")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchDefaultReport()
    return () => controller.abort()
  }, [user])

  // 当报告ID变化时保存到localStorage
  useEffect(() => {
    if (currentReportId) {
      // 只有当ID有值时才保存
      localStorage.setItem("currentReportId", currentReportId)
    }
  }, [currentReportId])

  return (
    <ReportContext.Provider
      value={{ currentReportId, setCurrentReportId, isLoading }}
    >
      {children}
    </ReportContext.Provider>
  )
}
