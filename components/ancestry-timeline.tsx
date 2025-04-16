"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// 祖源时间线数据
const timelineData = {
  recent: [
    {
      generation: 1,
      period: "1930-1960",
      ancestors: [
        { region: "East Asian", percentage: 45, details: "Primarily Northern Chinese" },
        { region: "European", percentage: 30, details: "Primarily Northern European" },
      ],
    },
    {
      generation: 2,
      period: "1900-1930",
      ancestors: [
        { region: "East Asian", percentage: 50, details: "Northern Chinese and Korean" },
        { region: "European", percentage: 25, details: "Northern European" },
        { region: "South Asian", percentage: 10, details: "Northern Indian" },
      ],
    },
    {
      generation: 3,
      period: "1870-1900",
      ancestors: [
        { region: "East Asian", percentage: 55, details: "Northern Chinese, Korean and Japanese" },
        { region: "European", percentage: 20, details: "Northern and Eastern European" },
        { region: "South Asian", percentage: 15, details: "Northern Indian" },
      ],
    },
    {
      generation: 4,
      period: "1840-1870",
      ancestors: [
        { region: "East Asian", percentage: 60, details: "Northern Chinese, Korean and Japanese" },
        { region: "European", percentage: 15, details: "Northern and Eastern European" },
        { region: "South Asian", percentage: 15, details: "Northern Indian" },
        { region: "African", percentage: 5, details: "West African" },
      ],
    },
  ],
  ancient: [
    {
      period: "10,000-8,000 BCE",
      event: "Neolithic Revolution",
      population: "Early Farmers",
      contribution: 15,
      details: "Agricultural practices spread from the Fertile Crescent",
    },
    {
      period: "3,000-1,000 BCE",
      event: "Bronze Age Migrations",
      population: "Indo-European Speakers",
      contribution: 25,
      details: "Spread of Indo-European languages and bronze technology",
    },
    {
      period: "500 BCE-500 CE",
      event: "Silk Road Exchanges",
      population: "East-West Traders",
      contribution: 20,
      details: "Cultural and genetic exchanges along trade routes",
    },
    {
      period: "1200-1500 CE",
      event: "Mongol Empire",
      population: "Central Asian Nomads",
      contribution: 10,
      details: "Genetic impact of the largest contiguous land empire",
    },
  ],
}

export function AncestryTimeline() {
  const { language } = useLanguage()
  const [timelineView, setTimelineView] = useState<"recent" | "ancient">("recent")

  const translations = {
    en: {
      recentAncestry: "Recent Ancestry",
      ancientAncestry: "Ancient Ancestry",
      generation: "Generation",
      period: "Time Period",
      ancestors: "Ancestors",
      event: "Historical Event",
      population: "Population",
      geneticContribution: "Genetic Contribution",
      details: "Details",
    },
    "zh-CN": {
      recentAncestry: "近期祖源",
      ancientAncestry: "远古祖源",
      generation: "代",
      period: "时期",
      ancestors: "祖先",
      event: "历史事件",
      population: "人群",
      geneticContribution: "基因贡献",
      details: "详情",
    },
  }

  const t = (key: string) => {
    return translations[language][key] || key
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{language === "en" ? "Ancestry Timeline" : "祖源时间线"}</CardTitle>
        <Tabs value={timelineView} onValueChange={(v) => setTimelineView(v as "recent" | "ancient")}>
          <TabsList>
            <TabsTrigger value="recent">{t("recentAncestry")}</TabsTrigger>
            <TabsTrigger value="ancient">{t("ancientAncestry")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {timelineView === "recent" ? (
          <div className="space-y-8">
            {timelineData.recent.map((item, index) => (
              <div key={index} className="relative pl-8 pb-8">
                {/* 时间线连接线 */}
                {index < timelineData.recent.length - 1 && (
                  <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-border"></div>
                )}
                {/* 时间点标记 */}
                <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {item.generation}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <h3 className="font-medium">
                      {t("generation")} {item.generation}
                    </h3>
                    <span className="text-sm text-muted-foreground">{item.period}</span>
                  </div>
                  <div className="space-y-2 bg-secondary/30 p-3 rounded-md">
                    {item.ancestors.map((ancestor, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{
                              backgroundColor:
                                ancestor.region === "East Asian"
                                  ? "#4C9AFF"
                                  : ancestor.region === "European"
                                    ? "#57D9A3"
                                    : ancestor.region === "South Asian"
                                      ? "#FFC400"
                                      : "#FF5630",
                            }}
                          ></div>
                          <span className="text-sm">{ancestor.region}</span>
                        </div>
                        <div className="flex items-center">
                          <div className="text-sm font-medium mr-2">{ancestor.percentage}%</div>
                          <div className="text-xs text-muted-foreground">{ancestor.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {timelineData.ancient.map((item, index) => (
              <div key={index} className="border rounded-md p-4">
                <div className="flex justify-between mb-2">
                  <h3 className="font-medium">{item.period}</h3>
                  <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {item.contribution}% {t("geneticContribution")}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{t("event")}:</span>
                    <span className="text-sm">{item.event}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{t("population")}:</span>
                    <span className="text-sm">{item.population}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{item.details}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
