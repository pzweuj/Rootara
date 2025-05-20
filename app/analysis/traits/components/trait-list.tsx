"use client"

import type React from "react"

import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { TraitCard } from "./trait-card"
import type { Trait } from "@/types/trait"

interface TraitsListProps {
  traits: Trait[]
  onTraitClick: (trait: Trait) => void
  onDeleteClick: (e: React.MouseEvent, trait: Trait) => void
  onCreateClick: () => void
}

export function TraitsList({ traits, onTraitClick, onDeleteClick, onCreateClick }: TraitsListProps) {
  const { language } = useLanguage()

  const translations = {
    en: {
      createNewTrait: "Create New Trait",
    },
    "zh-CN": {
      createNewTrait: "创建新特征",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {traits.map((trait) => (
        <TraitCard
          key={trait.id}
          trait={trait}
          onClick={() => onTraitClick(trait)}
          onDeleteClick={(e) => onDeleteClick(e, trait)}
        />
      ))}

      {/* Create New Trait Card */}
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-dashed flex flex-col items-center justify-center"
        onClick={onCreateClick}
      >
        <CardContent className="flex flex-col items-center justify-center h-full py-8">
          <Plus className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-center">{t("createNewTrait")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
