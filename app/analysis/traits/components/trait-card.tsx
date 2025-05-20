"use client"

import type React from "react"

import { AlertCircle, Trash2 } from "lucide-react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { getCategoryColor, getCategoryName } from "@/lib/trait-utils"
import type { Trait } from "@/types/trait"

// Icon mapping for rendering
const iconMapping: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye: () => import("lucide-react").then((mod) => mod.Eye),
  Coffee: () => import("lucide-react").then((mod) => mod.Coffee),
  Moon: () => import("lucide-react").then((mod) => mod.Moon),
  Droplet: () => import("lucide-react").then((mod) => mod.Droplet),
  Brain: () => import("lucide-react").then((mod) => mod.Brain),
  Scissors: () => import("lucide-react").then((mod) => mod.Scissors),
  Utensils: () => import("lucide-react").then((mod) => mod.Utensils),
  Wine: () => import("lucide-react").then((mod) => mod.Wine),
  Clock: () => import("lucide-react").then((mod) => mod.Clock),
  Music: () => import("lucide-react").then((mod) => mod.Music),
  Heart: () => import("lucide-react").then((mod) => mod.Heart),
  Dna: () => import("lucide-react").then((mod) => mod.Dna),
  Leaf: () => import("lucide-react").then((mod) => mod.Leaf),
  Zap: () => import("lucide-react").then((mod) => mod.Zap),
  Sun: () => import("lucide-react").then((mod) => mod.Sun),
  Smile: () => import("lucide-react").then((mod) => mod.Smile),
  Frown: () => import("lucide-react").then((mod) => mod.Frown),
  Thermometer: () => import("lucide-react").then((mod) => mod.Thermometer),
  Wind: () => import("lucide-react").then((mod) => mod.Wind),
  Umbrella: () => import("lucide-react").then((mod) => mod.Umbrella),
  Flame: () => import("lucide-react").then((mod) => mod.Flame),
  Snowflake: () => import("lucide-react").then((mod) => mod.Snowflake),
  Activity: () => import("lucide-react").then((mod) => mod.Activity),
  AlertCircle: () => import("lucide-react").then((mod) => mod.AlertCircle),
  // Add other icons as needed
}

// Dynamically import icons
import dynamic from "next/dynamic"

// Create dynamic components for each icon
const dynamicIcons: Record<string, React.ComponentType<{ className?: string }>> = {}
Object.entries(iconMapping).forEach(([name]) => {
  dynamicIcons[name] = dynamic(() => import("lucide-react").then((mod) => mod[name as keyof typeof mod]))
})

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
