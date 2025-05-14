"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dna, Globe, Heart, Brain } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { Badge } from "@/components/ui/badge"
import { useReport } from "@/contexts/report-context" // 导入报告上下文


const profileData = {
  ancestryComposition: [
    { region: "East Asian", percentage: 45 },
    { region: "European", percentage: 30 },
    { region: "South Asian", percentage: 15 },
    { region: "African", percentage: 10 },
  ],
  totalSnps: 635287,
  healthTraits: 127,
  clinvarPathogenic: 20,
  reportId: "RPT-7A2B9C", // 添加报告编号
}

export function GeneticProfileOverview() {
  const { currentReportId } = useReport()

  profileData.reportId = currentReportId

  const { t, language } = useLanguage()

  // Translations for regions based on language
  const regionTranslations = {
    en: {
      "East Asian": "East Asian",
      European: "European",
      "South Asian": "South Asian",
      African: "African",
    },
    "zh-CN": {
      "East Asian": "东亚",
      European: "欧洲",
      "South Asian": "南亚",
      African: "非洲",
    },
  }

  // Get region name based on current language
  const getRegionName = (region: string) => {
    return language === "en" || language === "zh-CN"
      ? regionTranslations[language as keyof typeof regionTranslations][
          region as keyof (typeof regionTranslations)["en"]
        ]
      : region
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-medium flex items-center">
            <Dna className="mr-2 h-5 w-5 text-primary" />
            {language === "en" ? "Genetic Profile Overview" : "基因概况"}
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">
            {language === "en" ? "Report ID: " : "报告编号: "}
            {profileData.reportId}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-2xl font-semibold mb-4">
              {profileData.totalSnps.toLocaleString()} {language === "en" ? "SNPs Analyzed" : "个SNP已分析"}
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  {language === "en" ? "Ancestry Composition" : "祖源构成"}
                </div>
                <div className="space-y-3">
                  {profileData.ancestryComposition.map((ancestry) => (
                    <div key={ancestry.region} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{getRegionName(ancestry.region)}</span>
                      <div className="flex items-center">
                        <div className="w-32 h-3 bg-secondary rounded-full mr-2">
                          <div
                            className="h-3 bg-primary rounded-full"
                            style={{ width: `${ancestry.percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{ancestry.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm text-muted-foreground mb-3">
              {language === "en" ? "Analysis Summary" : "分析摘要"}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-secondary/30 border-none shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <Globe className="h-5 w-5 mr-2 text-blue-500" />
                    <span className="text-sm font-medium">
                      {language === "en" ? "4 Ancestry Regions" : "4个祖源区域"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "en"
                      ? "Your DNA indicates ancestry from 4 major global regions"
                      : "您的DNA显示来自4个主要全球区域的祖源"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/30 border-none shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <Heart className="h-5 w-5 mr-2 text-red-500" />
                    <span className="text-sm font-medium">
                      {language === "en" ? "35 Health Markers" : "35个健康标记"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "en" ? "Genetic variants related to health conditions" : "与健康状况相关的基因变异"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/30 border-none shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <Brain className="h-5 w-5 mr-2 text-purple-500" />
                    <span className="text-sm font-medium">
                      {language === "en" ? `${profileData.healthTraits} Traits` : `${profileData.healthTraits}个特征`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "en" ? "Physical and behavioral genetic traits" : "身体和行为的基因特征"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/30 border-none shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <Dna className="h-5 w-5 mr-2 text-green-500" />
                    <span className="text-sm font-medium">
                      {language === "en" ? "Last updated" : "Clinvar致病位点"}
                    </span>
                  </div>
                  <p className="text-xs font-medium">{profileData.clinvarPathogenic}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
