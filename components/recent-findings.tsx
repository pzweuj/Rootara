import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dna, Heart, Brain, Pill, Globe } from "lucide-react"

const findings = [
  {
    id: 1,
    title: "Lactose Tolerance",
    description: "You have the genetic marker associated with lactose tolerance.",
    date: "2023-07-15",
    type: "trait",
    icon: Brain,
    severity: "info",
  },
  {
    id: 2,
    title: "Caffeine Metabolism",
    description: "You metabolize caffeine more slowly than average.",
    date: "2023-07-10",
    type: "health",
    icon: Pill,
    severity: "moderate",
  },
  {
    id: 3,
    title: "Eastern European Ancestry",
    description: "New ancestry markers detected in Eastern Europe.",
    date: "2023-07-05",
    type: "ancestry",
    icon: Globe,
    severity: "info",
  },
  {
    id: 4,
    title: "Vitamin D Deficiency Risk",
    description: "Increased genetic risk for vitamin D deficiency.",
    date: "2023-07-12",
    type: "health",
    icon: Heart,
    severity: "elevated",
  },
  {
    id: 5,
    title: "Muscle Composition",
    description: "Your genetic profile indicates a higher proportion of fast-twitch muscle fibers.",
    date: "2023-07-18",
    type: "trait",
    icon: Brain,
    severity: "info",
  },
]

export function RecentFindings() {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "elevated":
        return "text-red-600 dark:text-red-400"
      case "moderate":
        return "text-yellow-600 dark:text-yellow-400"
      case "info":
      default:
        return "text-blue-600 dark:text-blue-400"
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case "health":
        return Heart
      case "ancestry":
        return Dna
      case "trait":
      default:
        return Brain
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Recent Findings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {findings.slice(0, 3).map((finding) => {
            const Icon = finding.icon || getIcon(finding.type)
            return (
              <div key={finding.id} className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium">{finding.title}</p>
                  <p className="text-xs text-muted-foreground">{finding.date}</p>
                </div>
                <div className="flex items-center">
                  <span className={`text-sm font-medium ${getSeverityColor(finding.severity)}`}>
                    <Icon className="h-4 w-4 inline mr-1" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <Button className="w-full mt-4" variant="outline">
          View All Findings
        </Button>
      </CardContent>
    </Card>
  )
}

