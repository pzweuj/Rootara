"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Download, Share2, Info } from "lucide-react"
import { AncestryMap } from "@/components/ancestry-map"
// 导入新组件
import { AncestryTimeline } from "@/components/ancestry-timeline"
import { HaplogroupDistribution } from "@/components/haplogroup-distribution"

export default function AncestryAnalysisPage() {
  const [timelineView, setTimelineView] = useState("recent")

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ancestry Analysis</h1>
          <p className="text-muted-foreground">Explore your genetic ancestry and find DNA relatives</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share Results
          </Button>
        </div>
      </div>

      <Tabs defaultValue="composition" className="space-y-4">
        <TabsList>
          <TabsTrigger value="composition">Ancestry Composition</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="haplogroups">Haplogroups</TabsTrigger>
        </TabsList>

        <TabsContent value="composition" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <AncestryMap />
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Understanding Your Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your ancestry composition estimates the proportion of your DNA that comes from each of 45+
                    populations worldwide.
                  </p>
                  <div className="flex items-start space-x-2">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <p className="text-sm">
                      The analysis is based on comparing your genome to reference populations from around the world.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full">
                    Learn More About Methodology
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 更新Timeline选项卡内容 */}
        <TabsContent value="timeline" className="space-y-4">
          <AncestryTimeline />
        </TabsContent>

        {/* 更新Haplogroups选项卡内容 */}
        <TabsContent value="haplogroups" className="space-y-4">
          <HaplogroupDistribution />
        </TabsContent>
      </Tabs>
    </div>
  )
}

