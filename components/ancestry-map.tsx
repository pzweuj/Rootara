"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"

const ancestryData = {
  global: [
    {
      region: "East Asian",
      percentage: 45,
      subregions: [
        { name: "Chinese", percentage: 30 },
        { name: "Japanese", percentage: 10 },
        { name: "Korean", percentage: 5 },
      ],
    },
    {
      region: "European",
      percentage: 30,
      subregions: [
        { name: "Northern European", percentage: 15 },
        { name: "Southern European", percentage: 10 },
        { name: "Eastern European", percentage: 5 },
      ],
    },
    {
      region: "South Asian",
      percentage: 15,
      subregions: [
        { name: "Indian", percentage: 10 },
        { name: "Pakistani", percentage: 5 },
      ],
    },
    {
      region: "African",
      percentage: 10,
      subregions: [
        { name: "West African", percentage: 7 },
        { name: "East African", percentage: 3 },
      ],
    },
  ],
}

// 区域名称的翻译
const regionTranslations = {
  "East Asian": "东亚",
  European: "欧洲",
  "South Asian": "南亚",
  African: "非洲",
  // 子区域翻译
  Chinese: "中国",
  Japanese: "日本",
  Korean: "韩国",
  "Northern European": "北欧",
  "Southern European": "南欧",
  "Eastern European": "东欧",
  Indian: "印度",
  Pakistani: "巴基斯坦",
  "West African": "西非",
  "East African": "东非",
}

export function AncestryMap() {
  const { language } = useLanguage()
  const [selectedView, setSelectedView] = useState("global")

  const translations = {
    en: {
      ancestryComposition: "Ancestry Composition",
      view: "View",
      global: "Global",
      european: "European",
      asian: "Asian",
      african: "African",
      subregions: "Subregions",
    },
    "zh-CN": {
      ancestryComposition: "祖源构成",
      view: "视图",
      global: "全球",
      european: "欧洲",
      asian: "亚洲",
      african: "非洲",
      subregions: "子区域",
    },
  }

  const t = (key: string) => {
    return translations[language as keyof typeof translations][key as keyof (typeof translations)['en']] || key
  }

  // 根据语言获取区域名称
  const getRegionName = (name: string) => {
    return language === "zh-CN" ? (regionTranslations[name as keyof typeof regionTranslations] || name) : name
  }

  const getColorForRegion = (region: string) => {
    const colors = {
      // 欧洲 - 蓝色系
      "European": "bg-blue-500",           // 蓝色 - 欧洲(总体)
      "Northern European": "bg-blue-600",   // 深蓝色 - 北欧
      "Southern European": "bg-blue-400",   // 浅蓝色 - 南欧
      "Eastern European": "bg-blue-300",    // 更浅蓝色 - 东欧
      "Western European": "bg-blue-700",    // 更深蓝色 - 西欧
      
      // 亚洲 - 黄色系
      "East Asian": "bg-yellow-500",       // 黄色 - 东亚(总体)
      "Chinese": "bg-yellow-600",          // 深黄色 - 中国
      "Japanese": "bg-yellow-400",         // 浅黄色 - 日本
      "Korean": "bg-yellow-300",           // 更浅黄色 - 韩国
      "South Asian": "bg-amber-500",       // 琥珀色 - 南亚(总体)
      "Indian": "bg-amber-600",            // 深琥珀色 - 印度
      "Pakistani": "bg-amber-400",         // 浅琥珀色 - 巴基斯坦
      "Southeast Asian": "bg-yellow-700",  // 深黄色 - 东南亚
      
      // 非洲 - 黑/灰色系
      "African": "bg-gray-800",            // 深灰色 - 非洲(总体)
      "West African": "bg-gray-900",        // 更深灰色 - 西非
      "East African": "bg-gray-700",        // 灰色 - 东非
      "North African": "bg-gray-600",       // 中灰色 - 北非
      "South African": "bg-gray-500",       // 浅灰色 - 南非
      
      // 大洋洲 - 绿色系
      "Oceanian": "bg-green-500",          // 绿色 - 大洋洲(总体)
      "Australian": "bg-green-600",         // 深绿色 - 澳大利亚
      "New Zealand": "bg-green-400",        // 浅绿色 - 新西兰
      "Polynesian": "bg-green-300",         // 更浅绿色 - 波利尼西亚
      
      // 美洲 - 红色系
      "North American": "bg-red-500",      // 红色 - 北美(总体)
      "Native American": "bg-red-700",      // 深红色 - 美洲原住民
      "South American": "bg-red-400",      // 浅红色 - 南美
      "Central American": "bg-red-300",    // 更浅红色 - 中美
      "Caribbean": "bg-red-600",           // 深红色 - 加勒比
      
      // 其他区域
      "Middle Eastern": "bg-orange-500",   // 橙色 - 中东
      default: "bg-gray-400",              // 默认灰色
    }
    return colors[region as keyof typeof colors] || colors.default
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{t("ancestryComposition")}</CardTitle>
        {/* 删除了地区切换按钮 */}
      </CardHeader>
      <CardContent>
        <div className="relative h-[300px] w-full bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden mb-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/placeholder.svg?height=300&width=500"
              alt="World Map"
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {language === "zh-CN"
                  ? "互动祖源地图可视化将显示在这里"
                  : "Interactive ancestry map visualization would appear here"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {ancestryData.global.map((ancestry) => (
            <div key={ancestry.region}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{getRegionName(ancestry.region)}</span>
                <span className="text-sm">{ancestry.percentage}%</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full">
                <div
                  className={`h-2 rounded-full ${getColorForRegion(ancestry.region)}`}
                  style={{ width: `${ancestry.percentage}%` }}
                ></div>
              </div>
              <div className="pl-4 mt-1 space-y-1">
                {ancestry.subregions.map((subregion) => (
                  <div key={subregion.name} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{getRegionName(subregion.name)}</span>
                    <span>{subregion.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

