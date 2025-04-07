"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react"

// 单倍群数据
const haplogroups = {
  maternal: {
    id: "H1c3",
    description:
      "Haplogroup H is the most common mitochondrial haplogroup in Europe. It is found in approximately 40% of the European population.",
    descriptionZh: "单倍群H是欧洲最常见的线粒体单倍群。它在欧洲人口中的比例约为40%。",
    // 删除 distribution 数据
    phylogeneticTree: [
      { id: "L", level: 0, children: ["L0", "L1", "L2", "L3"] },
      { id: "L3", level: 1, children: ["M", "N"] },
      { id: "N", level: 2, children: ["R"] },
      { id: "R", level: 3, children: ["R0"] },
      { id: "R0", level: 4, children: ["HV"] },
      { id: "HV", level: 5, children: ["H", "V"] },
      { id: "H", level: 6, children: ["H1", "H2", "H3"] },
      { id: "H1", level: 7, children: ["H1a", "H1b", "H1c"] },
      { id: "H1c", level: 8, children: ["H1c1", "H1c2", "H1c3"] },
      { id: "H1c3", level: 9, children: [] },
    ],
  },
  paternal: {
    id: "R1b1b2",
    description:
      "R1b is the most common paternal haplogroup in Western Europe. In some areas, it comprises over 80% of the Y-chromosome gene pool.",
    descriptionZh: "R1b是西欧最常见的父系单倍群。在某些地区，它占Y染色体基因库的80%以上。",
    distribution: [
      { region: "Western Europe", regionZh: "西欧", percentage: 60 },
      { region: "Eastern Europe", regionZh: "东欧", percentage: 30 },
      { region: "Central Asia", regionZh: "中亚", percentage: 15 },
      { region: "Middle East", regionZh: "中东", percentage: 10 },
    ],
    phylogeneticTree: [
      { id: "A", level: 0, children: ["BT"] },
      { id: "BT", level: 1, children: ["CT"] },
      { id: "CT", level: 2, children: ["CF", "DE"] },
      { id: "CF", level: 3, children: ["C", "F"] },
      { id: "F", level: 4, children: ["GHIJK"] },
      { id: "GHIJK", level: 5, children: ["G", "HIJK"] },
      { id: "HIJK", level: 6, children: ["H", "IJK"] },
      { id: "IJK", level: 7, children: ["I", "JK"] },
      { id: "JK", level: 8, children: ["J", "K"] },
      { id: "K", level: 9, children: ["LT", "K2"] },
      { id: "K2", level: 10, children: ["K2a", "K2b"] },
      { id: "K2b", level: 11, children: ["P"] },
      { id: "P", level: 12, children: ["Q", "R"] },
      { id: "R", level: 13, children: ["R1", "R2"] },
      { id: "R1", level: 14, children: ["R1a", "R1b"] },
      { id: "R1b", level: 15, children: ["R1b1"] },
      { id: "R1b1", level: 16, children: ["R1b1a", "R1b1b"] },
      { id: "R1b1b", level: 17, children: ["R1b1b1", "R1b1b2"] },
      { id: "R1b1b2", level: 18, children: [] },
    ],
  },
}

export function HaplogroupDistribution() {
  const { language } = useLanguage()
  const [activeTab, setActiveTab] = useState<"maternal" | "paternal">("maternal")
  const [zoomLevel, setZoomLevel] = useState(1)

  const translations = {
    en: {
      haplogroupDistribution: "Haplogroup Distribution",
      haplogroupDescription: "Your maternal and paternal haplogroups trace your genetic ancestry through time",
      maternal: "Maternal Haplogroup",
      paternal: "Paternal Haplogroup",
      distribution: "Distribution",
      phylogeneticTree: "Phylogenetic Tree",
      yourHaplogroup: "Your Haplogroup",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      reset: "Reset",
      region: "Region",
      percentage: "Percentage",
    },
    "zh-CN": {
      haplogroupDistribution: "单倍群分布",
      haplogroupDescription: "您的母系和父系单倍群追踪您的基因祖先",
      maternal: "母系单倍群",
      paternal: "父系单倍群",
      distribution: "分布",
      phylogeneticTree: "系统发生树",
      yourHaplogroup: "您的单倍群",
      zoomIn: "放大",
      zoomOut: "缩小",
      reset: "重置",
      region: "地区",
      percentage: "百分比",
    },
  }

  const t = (key) => {
    return translations[language][key] || key
  }

  const renderPhylogeneticTree = (data) => {
    const maxLevel = Math.max(...data.map((node) => node.level))
    const nodeWidth = 60
    const nodeHeight = 30
    const horizontalSpacing = 80
    const verticalSpacing = 40
    const totalWidth = (maxLevel + 1) * horizontalSpacing + nodeWidth
    const totalHeight = data.length * verticalSpacing

    // 计算每个节点的位置
    const nodePositions = {}
    data.forEach((node) => {
      const x = node.level * horizontalSpacing

      // 找出同级节点的数量和当前节点的索引
      const sameLevel = data.filter((n) => n.level === node.level)
      const indexInLevel = sameLevel.findIndex((n) => n.id === node.id)

      // 计算y位置，使同级节点均匀分布
      const y = (indexInLevel + 1) * (totalHeight / (sameLevel.length + 1))

      nodePositions[node.id] = { x, y }
    })

    // 生成连接线
    const lines = []
    data.forEach((node) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach((childId) => {
          const child = data.find((n) => n.id === childId)
          if (child && nodePositions[node.id] && nodePositions[childId]) {
            lines.push({
              x1: nodePositions[node.id].x + nodeWidth,
              y1: nodePositions[node.id].y + nodeHeight / 2,
              x2: nodePositions[childId].x,
              y2: nodePositions[childId].y + nodeHeight / 2,
            })
          }
        })
      }
    })

    return (
      <div className="relative overflow-auto" style={{ maxHeight: "400px" }}>
        <div className="flex justify-center mb-4">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => setZoomLevel((prev) => Math.min(prev + 0.2, 2))}>
              <ZoomIn className="h-4 w-4 mr-1" />
              {t("zoomIn")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoomLevel((prev) => Math.max(prev - 0.2, 0.5))}>
              <ZoomOut className="h-4 w-4 mr-1" />
              {t("zoomOut")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoomLevel(1)}>
              <RotateCw className="h-4 w-4 mr-1" />
              {t("reset")}
            </Button>
          </div>
        </div>

        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top left",
            width: totalWidth,
            height: totalHeight,
            position: "relative",
          }}
        >
          {/* 连接线 */}
          {lines.map((line, index) => (
            <svg
              key={`line-${index}`}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: totalWidth,
                height: totalHeight,
                overflow: "visible",
              }}
            >
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.5"
              />
            </svg>
          ))}

          {/* 节点 */}
          {data.map((node) => {
            const position = nodePositions[node.id]
            if (!position) return null

            const isYourHaplogroup = node.id === haplogroups[activeTab].id

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: position.x,
                  top: position.y,
                  width: nodeWidth,
                  height: nodeHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: isYourHaplogroup ? "2px solid currentColor" : "1px solid currentColor",
                  borderRadius: "4px",
                  backgroundColor: isYourHaplogroup ? "rgba(var(--primary), 0.1)" : "transparent",
                  fontSize: "0.75rem",
                  fontWeight: isYourHaplogroup ? "bold" : "normal",
                }}
              >
                {node.id}
                {isYourHaplogroup && (
                  <div className="absolute -top-5 text-xs text-primary whitespace-nowrap">{t("yourHaplogroup")}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("haplogroupDistribution")}</CardTitle>
        <CardDescription>{t("haplogroupDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "maternal" | "paternal")}>
          <TabsList className="mb-4">
            <TabsTrigger value="maternal">{t("maternal")}</TabsTrigger>
            <TabsTrigger value="paternal">{t("paternal")}</TabsTrigger>
          </TabsList>

          <TabsContent value="maternal" className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary mb-2">{haplogroups.maternal.id}</div>
              <p className="text-sm text-muted-foreground mb-4">
                {language === "zh-CN" ? haplogroups.maternal.descriptionZh : haplogroups.maternal.description}
              </p>
            </div>

            {/* 直接显示系统发生树，删除内部的Tabs */}
            <div className="pt-4">
              {renderPhylogeneticTree(haplogroups.maternal.phylogeneticTree)}
            </div>
          </TabsContent>

          <TabsContent value="paternal" className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary mb-2">{haplogroups.paternal.id}</div>
              <p className="text-sm text-muted-foreground mb-4">
                {language === "zh-CN" ? haplogroups.paternal.descriptionZh : haplogroups.paternal.description}
              </p>
            </div>

            {/* 直接显示系统发生树，删除内部的Tabs */}
            <div className="pt-4">
              {renderPhylogeneticTree(haplogroups.paternal.phylogeneticTree)}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

