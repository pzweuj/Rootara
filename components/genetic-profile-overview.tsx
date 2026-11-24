"use client"

import { Dna } from "lucide-react"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

export function GeneticProfileOverview({
  currentReportId,
  totalSnps,
  ancestry,
  haplogroups,
}: {
  currentReportId: string
  totalSnps: number
  ancestry: Record<string, number>
  haplogroups: { y_hap?: string; mt_hap?: string }
}) {
  const { t, language } = useLanguage()
  const ancestryComposition = Object.entries(ancestry)
    .filter(([, percentage]) => percentage > 0)
    .map(([region, percentage]) => ({ region, percentage }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 4)

  // 更新区域名称翻译对象
  const regionTranslations = {
    "zh-CN": {
      Kushitic: "库希特",
      North_Iberian: "北伊比利亚",
      East_Iberian: "东伊比利亚",
      North_African: "北非",
      South_Caucasian: "南高加索",
      North_Caucasian: "北高加索",
      Paleo_Balkan: "古巴尔干",
      Turkic_Altai: "突厥阿尔泰",
      Proto_Austronesian: "南太平洋群岛",
      Nilotic: "尼罗特",
      East_Med: "东地中海",
      Omotic: "奥摩地区",
      Munda: "蒙达",
      North_Amerind: "北美原住民",
      Arabic: "阿拉伯",
      East_Euro: "东欧",
      Central_African: "中非地区",
      Andean: "安第斯",
      Indo_Chinese: "法属安南",
      South_Indian: "南印度",
      NE_Asian: "东北亚",
      Volgan: "伏尔加",
      Mongolian: "蒙古地区",
      Siberian: "西伯利亚",
      North_Sea_Germanic: "北海日耳曼",
      Celtic: "凯尔特",
      West_African: "西非地区",
      West_Finnic: "西芬兰",
      Uralic: "乌拉尔",
      Sahelian: "萨赫勒",
      NW_Indian: "西北印度",
      East_African: "东非地区",
      East_Asian: "东亚地区",
      Amuro_Manchurian: "阿穆尔-满洲",
      Scando_Germanic: "斯堪的纳维亚日耳曼",
      Iranian: "伊朗",
      South_African: "南非",
      Amazonian: "亚马逊流域",
      Baltic: "波罗的海",
      Malay: "马来",
      Meso_Amerind: "中美洲原住民",
      South_Chinese: "中国华南",
      Papuan: "巴布亚",
      West_Med: "西地中海",
      Pamirian: "帕米尔",
      Central_Med: "中地中海",
      Tibeto_Burman: "藏缅地区",
      // 保留原有的翻译以防万一
      European: "欧洲",
      South_Asian: "南亚",
      African: "非洲",
    },
  }

  // 修改获取区域名称的函数
  const getRegionName = (region: string) => {
    if (language === "zh-CN" && region in regionTranslations["zh-CN"]) {
      return regionTranslations["zh-CN"][
        region as keyof (typeof regionTranslations)["zh-CN"]
      ]
    }
    return region
  }

  // 单倍群翻译
  const haplogroupTranslations = {
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
      error: "加载单倍群数据失败",
    },
  }

  const ht = (
    key: keyof (typeof haplogroupTranslations)[keyof typeof haplogroupTranslations]
  ) => {
    return (
      haplogroupTranslations[language as keyof typeof haplogroupTranslations][
        key as keyof (typeof haplogroupTranslations)[typeof language]
      ] || key
    )
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-medium flex items-center">
            <Dna className="mr-2 h-5 w-5 text-primary" />
            {t("geneticProfileOverview")}
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">
            {t("reportId")}
            {currentReportId}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-2xl font-semibold mb-4">
              <span>
                {totalSnps.toLocaleString()} {t("variantsAnalyzed")}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  {t("ancestryComposition")}
                </div>
                <div className="space-y-3">
                  {ancestryComposition.map((ancestry) => (
                    <div key={ancestry.region} className="flex items-center">
                      <span className="text-sm font-medium w-28 mr-24">
                        {getRegionName(ancestry.region)}
                      </span>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-2 flex-1 rounded bg-muted">
                          <div
                            className="h-2 rounded bg-primary"
                            style={{ width: `${ancestry.percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {ancestry.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 查看详情按钮 - 移动到祖源构成下方 */}
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <Link href="/analysis/ancestry">
                      {t("ancestryDetails")}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm text-muted-foreground mb-3 flex justify-between items-center">
              <span>{t("haplogroups")}</span>
            </div>

            <div className="space-y-4">
              {/* 父系谱系 Y-DNA - 蓝色卡片 */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  {ht("paternalLineage")}
                </h3>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {haplogroups.y_hap || "未知"}
                </p>
              </div>

              {/* 母系谱系 mtDNA - 红色卡片 */}
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                  {ht("maternalLineage")}
                </h3>
                <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                  {haplogroups.mt_hap || "未知"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
