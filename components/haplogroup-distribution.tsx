"use client"

import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context"

interface HaplogroupData {
  y_hap: string
  mt_hap: string
}

// 添加环境变量配置
const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || 'http://0.0.0.0:8000';
const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001"; // 从环境变量获取API_KEY，默认为"ddd"


export function HaplogroupDistribution() {
  const { language } = useLanguage()
  const { currentReportId } = useReport()
  const [haplogroupData, setHaplogroupData] = useState<HaplogroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const translations = {
    en: {
      maternalLineage: "Maternal Lineage (mtDNA)",
      paternalLineage: "Paternal Lineage (Y-DNA)",
      loading: "Loading...",
      error: "Failed to load haplogroup data",
    },
    "zh-CN": {
      maternalLineage: "母系遗传 (mtDNA)",
      paternalLineage: "父系遗传 (Y-DNA)",
      loading: "加载中...",
      error: "加载祖源数据失败",
    },
  }

  const t = (key: keyof (typeof translations)[keyof typeof translations]) => {
    return translations[language as keyof typeof translations][key as keyof (typeof translations)[typeof language]] || key
  }

  useEffect(() => {
    const fetchHaplogroupData = async () => {
      if (!currentReportId) {
        console.log("没有可用的报告ID")
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${API_BASE_URL}/report/${currentReportId}/haplogroup`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'x-api-key': API_KEY,
          },
          body: '',
        })

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`)
        }

        const data = await response.json()
        setHaplogroupData(data)
      } catch (err) {
        console.error("获取祖源数据失败:", err)
        setError(err instanceof Error ? err.message : "获取祖源数据失败")
      } finally {
        setLoading(false)
      }
    }

    fetchHaplogroupData()
  }, [currentReportId])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center">
          <p className="text-blue-700 dark:text-blue-300">{t("loading")}</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
          <p className="text-red-700 dark:text-red-300">{t("loading")}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800">
        <p className="text-red-700 dark:text-red-300">{t("error")}: {error}</p>
      </div>
    )
  }

  // 使用API返回的数据
  const yDnaHaplogroup = haplogroupData?.y_hap || "未知"
  const mtDnaHaplogroup = haplogroupData?.mt_hap || "未知"

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 父系谱系 Y-DNA - 蓝色卡片 */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">{t("paternalLineage")}</h3>
        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{yDnaHaplogroup}</p>
      </div>

      {/* 母系谱系 mtDNA - 红色卡片 */}
      <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">{t("maternalLineage")}</h3>
        <p className="text-3xl font-bold text-red-700 dark:text-red-300">{mtDnaHaplogroup}</p>
      </div>
    </div>
  )
}
