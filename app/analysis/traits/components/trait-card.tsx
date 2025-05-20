"use client"

import type React from "react"
import dynamic from "next/dynamic"
import { AlertCircle, Trash2 } from "lucide-react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { getCategoryColor, getCategoryName } from "@/lib/trait-utils"
import type { Trait } from "@/types/trait"

// Define icon names to be dynamically imported
const iconNames = [
  "Eye", "Coffee", "Moon", "Droplet", "Brain", "Scissors", "Utensils", 
  "Wine", "Clock", "Music", "Heart", "Dna", "Leaf", "Zap", "Sun", 
  "Smile", "Frown", "Thermometer", "Wind", "Umbrella", "Flame", 
  "Snowflake", "Activity", "AlertCircle"
  // 根据需要添加其他图标
];

// 创建动态组件
const dynamicIcons: Record<string, React.ComponentType<{ className?: string }>> = {};

iconNames.forEach((name) => {
  // 使用类型断言确保类型正确
  dynamicIcons[name] = dynamic(
async (): Promise<{ default: React.ComponentType<{ className?: string }> }> => {
      const module = await import("lucide-react");
      const Icon = module[name as keyof typeof module];
      // 确保返回的Icon组件符合ComponentType<{ className?: string }> 类型
      return { 
        default: Icon as React.ComponentType<{ className?: string }> 
      };
    },
    { ssr: false }
  ) as React.ComponentType<{ className?: string }>;
});

interface TraitCardProps {
  trait: Trait
  onClick: () => void
  onDeleteClick: (e: React.MouseEvent) => void
}

export function TraitCard({ trait, onClick, onDeleteClick }: TraitCardProps) {
  const { language } = useLanguage()

  // Get the icon component or fallback to AlertCircle
  const IconComponent = dynamicIcons[trait.icon] || AlertCircle

  return (
    <Card className="relative cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <IconComponent className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">{trait.name[language as keyof typeof trait.name]}</CardTitle>
          </div>
          <Badge className={getCategoryColor(trait.category)}>{getCategoryName(trait.category, language)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="text-xl font-bold mb-1">{trait.result[language as keyof typeof trait.result]}</div>
          <p className="text-sm text-muted-foreground">
            {trait.description[language as keyof typeof trait.description]}
          </p>
        </div>
      </CardContent>
      {!trait.isDefault && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-2 right-2 text-muted-foreground hover:bg-secondary"
          onClick={onDeleteClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </Card>
  )
}
