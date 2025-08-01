"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"

const healthRisks = [
  { name: "Type 2 Diabetes", nameZh: "2型糖尿病", risk: "Average", riskZh: "一般", level: 50, variants: 3 },
  {
    name: "Coronary Heart Disease",
    nameZh: "冠心病",
    risk: "Slightly Elevated",
    riskZh: "略微升高",
    level: 65,
    variants: 5,
  },
  { name: "Alzheimer's Disease", nameZh: "阿尔茨海默病", risk: "Reduced", riskZh: "降低", level: 30, variants: 2 },
  { name: "Macular Degeneration", nameZh: "黄斑变性", risk: "Elevated", riskZh: "升高", level: 75, variants: 4 },
  { name: "Celiac Disease", nameZh: "乳糜泻", risk: "Average", riskZh: "一般", level: 45, variants: 1 },
]

export function HealthRiskSummary() {
  const { language, t } = useLanguage()
  const router = useRouter()

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "Elevated":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "Slightly Elevated":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "Reduced":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "Average":
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getRiskColor = (level: number) => {
    if (level >= 70) return "bg-red-500"
    if (level >= 60) return "bg-yellow-500"
    if (level <= 40) return "bg-green-500"
    return "bg-blue-500"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("healthRiskSummary")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {healthRisks.map((risk) => (
            <div key={risk.name} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {getRiskIcon(risk.risk)}
                  <span className="ml-2 text-sm font-medium">{language === "zh-CN" ? risk.nameZh : risk.name}</span>
                </div>
                <span className="text-sm">{language === "zh-CN" ? risk.riskZh : risk.risk}</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full ${getRiskColor(risk.level)} rounded-full transition-all duration-300`}
                  style={{ width: `${risk.level}%` }}
                ></div>
              </div>
              <p className="text-xs text-right text-muted-foreground">
                {risk.variants} {t("geneticVariants")}
              </p>
            </div>
          ))}
          <Button className="w-full mt-2" variant="outline" onClick={() => router.push("/analysis/health")}>
            {t("viewDetailedHealthReport")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
