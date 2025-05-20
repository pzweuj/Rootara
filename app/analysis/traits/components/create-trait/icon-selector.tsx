"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import * as LucideIcons from "lucide-react"

interface IconSelectorProps {
  selectedIcon: string
  onSelectIcon: (icon: string) => void
}

export function IconSelector({ selectedIcon, onSelectIcon }: IconSelectorProps) {
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

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  // Common icons to display in the selector
  const commonIcons = [
    "AlertCircle",
    "Eye",
    "Coffee",
    "Moon",
    "Droplet",
    "Brain",
    "Scissors",
    "Utensils",
    "Wine",
    "Clock",
    "Music",
    "Heart",
    "Dna",
    "Leaf",
    "Zap",
    "Sun",
    "Smile",
    "Frown",
    "Thermometer",
    "Wind",
    "Umbrella",
    "Flame",
    "Snowflake",
    "Activity",
    "Apple",
    "Baby",
    "Banana",
    "Beef",
    "Beer",
    "Book",
    "Braces",
    "Briefcase",
    "Cake",
    "Camera",
    "Car",
    "Cat",
    "ChefHat",
    "Cherry",
    "Cloud",
    "Code",
    "Compass",
    "Cookie",
    "Cpu",
    "Crown",
    "Diamond",
    "Dog",
    "Egg",
    "Fish",
    "Flower",
  ]

  return (
    <div className="space-y-2 mt-4">
      <Label>{t("iconSelector")}</Label>
      <div className="p-2 border rounded-md">
        <p className="text-xs text-muted-foreground mb-2">{t("selectIcon")}</p>
        <div className="grid grid-cols-8 gap-2">
          {commonIcons.map((iconName) => {
            const IconComponent = (LucideIcons as any)[iconName]
            return (
              <Button
                key={iconName}
                type="button"
                variant={selectedIcon === iconName ? "default" : "outline"}
                size="icon"
                className="h-10 w-10"
                onClick={() => onSelectIcon(iconName)}
              >
                {IconComponent && <IconComponent className="h-5 w-5" />}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
