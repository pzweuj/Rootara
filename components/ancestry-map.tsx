"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

  const t = (key) => {
    return translations[language][key] || key
  }

  // 根据语言获取区域名称
  const getRegionName = (name) => {
    return language === "zh-CN" ? regionTranslations[name] || name : name
  }

  const getColorForRegion = (region) => {
    const colors = {
      "East Asian": "bg-blue-500",
      European: "bg-green-500",
      "South Asian": "bg-yellow-500",
      African: "bg-red-500",
      default: "bg-gray-500",
    }
    return colors[region] || colors.default
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{t("ancestryComposition")}</CardTitle>
        <Select value={selectedView} onValueChange={setSelectedView}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("view")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">{t("global")}</SelectItem>
            <SelectItem value="european">{t("european")}</SelectItem>
            <SelectItem value="asian">{t("asian")}</SelectItem>
            <SelectItem value="african">{t("african")}</SelectItem>
          </SelectContent>
        </Select>
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

