"use client"

import {
  Activity,
  AlertCircle,
  Apple,
  Baby,
  Banana,
  Beef,
  Beer,
  Book,
  Braces,
  Brain,
  Briefcase,
  Cake,
  Camera,
  Car,
  Cat,
  ChefHat,
  Cherry,
  Clock,
  Cloud,
  Code,
  Coffee,
  Compass,
  Cookie,
  Cpu,
  Crown,
  Diamond,
  Dna,
  Dog,
  Droplet,
  Egg,
  Eye,
  Fish,
  Flame,
  Flower,
  Frown,
  Heart,
  Leaf,
  Moon,
  Music,
  Scissors,
  Smile,
  Snowflake,
  Sun,
  Thermometer,
  Umbrella,
  Utensils,
  Wind,
  Wine,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"

const commonIcons = {
  AlertCircle,
  Eye,
  Coffee,
  Moon,
  Droplet,
  Brain,
  Scissors,
  Utensils,
  Wine,
  Clock,
  Music,
  Heart,
  Dna,
  Leaf,
  Zap,
  Sun,
  Smile,
  Frown,
  Thermometer,
  Wind,
  Umbrella,
  Flame,
  Snowflake,
  Activity,
  Apple,
  Baby,
  Banana,
  Beef,
  Beer,
  Book,
  Braces,
  Briefcase,
  Cake,
  Camera,
  Car,
  Cat,
  ChefHat,
  Cherry,
  Cloud,
  Code,
  Compass,
  Cookie,
  Cpu,
  Crown,
  Diamond,
  Dog,
  Egg,
  Fish,
  Flower,
}

interface IconSelectorProps {
  selectedIcon: string
  onSelectIcon: (icon: string) => void
}

export function IconSelector({
  selectedIcon,
  onSelectIcon,
}: IconSelectorProps) {
  const { language } = useLanguage()

  const translations = {
    en: {
      iconSelector: "Icon Selector",
      selectIcon: "Select an icon for your trait",
    },
    "zh-CN": {
      iconSelector: "图标选择器",
      selectIcon: "为您的特征选择一个图标",
    },
  }

  const t = (key: keyof typeof translations.en) =>
    translations[language as keyof typeof translations][key] || key

  return (
    <div className="space-y-2 mt-2 sm:mt-4">
      <Label className="text-sm">{t("iconSelector")}</Label>
      <div className="p-2 sm:p-3 border rounded-md">
        <p className="text-xs text-muted-foreground mb-2">{t("selectIcon")}</p>
        <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1 sm:gap-2 max-h-32 sm:max-h-40 overflow-y-auto">
          {Object.entries(commonIcons).map(([iconName, IconComponent]) => {
            return (
              <Button
                key={iconName}
                type="button"
                variant={selectedIcon === iconName ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                onClick={() => onSelectIcon(iconName)}
              >
                {IconComponent && (
                  <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
