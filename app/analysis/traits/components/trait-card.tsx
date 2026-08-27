"use client"

import {
  Activity,
  AlertCircle,
  Clock,
  Coffee,
  Dna,
  Droplet,
  Eye,
  Frown,
  Heart,
  Leaf,
  Moon,
  Scissors,
  Smile,
  Snowflake,
  Sun,
  Trash2,
  Umbrella,
  Utensils,
  Wind,
  Wine,
  Zap,
} from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { getCategoryColor, getCategoryName } from "@/lib/trait-utils"
import type { TraitCardModel } from "@/types/trait"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  AlertCircle,
  Clock,
  Coffee,
  Dna,
  Droplet,
  Eye,
  Frown,
  Heart,
  Leaf,
  Moon,
  Scissors,
  Smile,
  Snowflake,
  Sun,
  Umbrella,
  Utensils,
  Wind,
  Wine,
  Zap,
}

interface TraitCardProps {
  trait: TraitCardModel
  onClick: () => void
  onDeleteClick: (e: React.MouseEvent) => void
}

export const TraitCard = React.memo(
  ({ trait, onClick, onDeleteClick }: TraitCardProps) => {
    const { language } = useLanguage()
    const IconComponent = iconMap[trait.icon || "Dna"] || Dna
    const evaluation = trait.evaluation
    const result =
      evaluation.resultCurrent?.[language] || evaluation.resultCurrent?.default
    const missingMessage =
      language === "zh-CN"
        ? `本报告未检测到 ${evaluation.missingRsids?.join("、") || "所需位点"}`
        : `Not detected in this report: ${evaluation.missingRsids?.join(", ") || "required loci"}`
    const invalidMessage =
      language === "zh-CN"
        ? "位点方向无法可靠确认"
        : "Variant orientation could not be verified"

    return (
      <Card
        className="relative cursor-pointer hover:shadow-md transition-shadow [content-visibility:auto] [contain-intrinsic-size:280px]"
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-start min-w-0">
              <IconComponent className="h-5 w-5 text-primary mr-2 mt-0.5 shrink-0" />
              <CardTitle className="text-lg leading-snug">
                {trait.name[language] || trait.name.default || trait.name.en}
              </CardTitle>
            </div>
            <Badge className={getCategoryColor(trait.category)}>
              {getCategoryName(trait.category, language)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 pt-2">
            {trait.sourceLabel && (
              <Badge variant="secondary">{trait.sourceLabel}</Badge>
            )}
            {[
              ...new Set(
                trait.loci
                  .map((locus) => locus.gene)
                  .filter((gene): gene is string => Boolean(gene))
              ),
            ].map((gene) => (
              <Badge key={gene} variant="outline">
                {gene}
              </Badge>
            ))}
            {trait.loci.map((locus) => (
              <Badge key={locus.rsid} variant="outline">
                {locus.rsid}
              </Badge>
            ))}
            {trait.evidenceGrade && (
              <Badge variant="outline">
                {language === "zh-CN" ? "证据 " : "Evidence "}
                {trait.evidenceGrade}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evaluation.status === "ok" && result ? (
            <div className="text-xl font-bold mb-1">{result}</div>
          ) : evaluation.status === "insufficient_data" ? (
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">
              {missingMessage}
            </div>
          ) : (
            <div className="text-sm font-semibold text-destructive mb-1">
              {invalidMessage}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {trait.description[language] ||
              trait.description.default ||
              trait.description.en}
          </p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground font-mono">
            {trait.loci.map((locus) => {
              const grch38 = locus.assembly.GRCh38
              const alleles = [locus.referenceAllele, ...locus.alternateAlleles]
                .filter(Boolean)
                .join("/")
              return (
                <p key={locus.rsid}>
                  {locus.rsid}
                  {locus.gene ? ` · ${locus.gene}` : ""}
                  {grch38?.chromosome && grch38.position
                    ? ` · GRCh38 chr${grch38.chromosome}:${grch38.position}`
                    : language === "zh-CN"
                      ? " · GRCh38 位点核验中"
                      : " · GRCh38 locus pending verification"}
                  {alleles ? ` · ${alleles}` : ""}
                  {locus.effectAllele
                    ? ` · ${language === "zh-CN" ? "效应" : "effect"} ${locus.effectAllele}`
                    : ""}
                  {locus.effectDirection ? ` (${locus.effectDirection})` : ""}
                </p>
              )
            })}
          </div>
        </CardContent>
        {trait.isDefault === false && (
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
)

TraitCard.displayName = "TraitCard"
