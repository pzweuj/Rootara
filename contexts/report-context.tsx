"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"

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

  // 从后端获取默认报告ID
  useEffect(() => {
    const fetchDefaultReport = async () => {
      // 先检查localStorage中是否有保存的报告ID
      const savedReportId = localStorage.getItem("currentReportId")
      if (savedReportId) {
        setCurrentReportId(savedReportId)
        setIsLoading(false)
        return
      }

      try {
        // 调用API获取所有报告
        const response = await fetch("/api/report/all", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "",
        })

        if (!response.ok) {
          throw new Error("获取报告列表失败")
        }

        const data = await response.json()

        // 查找默认报告
        const defaultReport = Array.isArray(data)
          ? data.find((report: Report) => report.isDefault)
          : null

        if (defaultReport) {
          setCurrentReportId(defaultReport.id)
        } else if (Array.isArray(data) && data.length > 0) {
          // 如果没有默认报告但有报告列表，使用第一个
          setCurrentReportId(data[0].id)
        } else {
          // 如果没有任何报告，使用原来的默认值
          setCurrentReportId("RPT_TEMPLATE01")
        }
      } catch (error) {
        console.error("获取默认报告错误:", error)
        // 出错时使用原来的默认值
        setCurrentReportId("RPT_TEMPLATE01")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDefaultReport()
  }, [])

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
