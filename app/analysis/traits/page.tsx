"use client"

import { AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import type React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { useReport } from "@/contexts/report-context" // 导入报告上下文
import {
  invalidateTraitCatalog,
  loadTraitCatalog,
  loadTraitResults,
} from "@/lib/trait-utils"
import type { Trait, TraitCardModel, TraitCategory } from "@/types/trait"

import { CreateTraitDialog } from "./components/create-trait-dialog"
import { DeleteTraitDialog } from "./components/delete-trait-dialog"
import { TraitFilters } from "./components/trait-filters"
import { TraitImportExport } from "./components/trait-import-export"
import { TraitsList } from "./components/trait-list"

export default function TraitsPage() {
  const { language, t } = useLanguage()
  const router = useRouter()
  const { currentReportId } = useReport() // 使用报告上下文获取当前报告ID
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TraitCategory>("all")
  const [traits, setTraits] = useState<TraitCardModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [traitToDelete, setTraitToDelete] = useState<TraitCardModel | null>(
    null
  )

  // Function to refresh traits data from API
  const refreshTraitsData = async (reportId: string, signal?: AbortSignal) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [catalog, resultPayload] = await Promise.all([
        loadTraitCatalog(),
        loadTraitResults(reportId, signal),
      ])
      if (catalog.version !== resultPayload.catalogVersion) {
        throw new Error("Trait catalog version changed during evaluation")
      }
      const resultById = new Map(
        resultPayload.results.map((result) => [result.traitId, result])
      )
      setTraits(
        catalog.traits.map((trait) => ({
          ...trait,
          evaluation: resultById.get(trait.id) || {
            traitId: trait.id,
            status: "invalid_rule" as const,
            resultKey: null,
            resultCurrent: null,
            genotypes: {},
            missingRsids: trait.loci.map((locus) => locus.rsid),
            detectedCount: 0,
            requiredCount: trait.loci.length,
          },
        }))
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      console.error("Failed to load traits:", error)
      setTraits([])
      setLoadError(
        language === "zh-CN" ? "特征数据加载失败" : "Failed to load traits"
      )
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }

  // Load traits on component mount and when report ID changes
  useEffect(() => {
    if (!currentReportId) {
      return
    }
    const controller = new AbortController()
    refreshTraitsData(currentReportId, controller.signal)
    return () => controller.abort()
  }, [currentReportId])

  // Filter traits based on search query and selected category
  const filteredTraits = traits.filter((trait) => {
    const matchesSearch = (trait.name[language] || trait.name.en)
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === "all" || trait.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Handle trait card click - navigate to detail page
  const handleTraitClick = (trait: TraitCardModel) => {
    router.push(`/analysis/traits/${trait.id}`)
  }

  // Handle creating a new trait
  const handleCreateTrait = async (newTrait: Trait) => {
    setIsCreateDialogOpen(false)

    toast.success(
      language === "en"
        ? `Trait created successfully with result: ${newTrait.result.en}`
        : `特征创建成功，结果为：${newTrait.result["zh-CN"]}`
    )

    // Case 3: Refresh traits list from backend after creating a new trait
    if (currentReportId) {
      invalidateTraitCatalog()
      await refreshTraitsData(currentReportId)
    }
  }

  // Handle deleting a trait
  const handleDeleteTrait = async () => {
    if (!traitToDelete) {
      return
    }

    setIsDeleteDialogOpen(false)
    setTraitToDelete(null)

    toast.success(t("traitDeletedSuccessfully"))

    // Case 4: Refresh traits list from backend after deleting a trait
    if (currentReportId) {
      invalidateTraitCatalog()
      await refreshTraitsData(currentReportId)
    }
  }

  // Open delete confirmation dialog
  const confirmDelete = (e: React.MouseEvent, trait: TraitCardModel) => {
    e.stopPropagation() // Prevent card click
    setTraitToDelete(trait)
    setIsDeleteDialogOpen(true)
  }

  // Handle importing traits
  const handleImportTraits = async (_importedTraits: Trait[]) => {
    // Case 5: Refresh traits list from backend after importing traits
    // Note: We refresh from backend instead of using importedTraits to ensure data consistency
    if (currentReportId) {
      invalidateTraitCatalog()
      await refreshTraitsData(currentReportId)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex space-x-4">
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 flex-[3]">
          <CardContent className="flex items-center space-x-4 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t("notice")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-[1] min-w-[200px] border-0 shadow-none">
          <CardContent className="flex items-center justify-center py-4">
            <Badge variant="outline" className="text-xs font-mono">
              {t("reportId")}
              {currentReportId}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <TraitFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <TraitImportExport onImport={handleImportTraits} />
      </div>

      {loadError && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label="loading traits"
        >
          {Array.from({ length: 9 }).map((_, index) => (
            <Card key={index} className="h-48 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && !loadError && (
        <TraitsList
          traits={filteredTraits}
          onTraitClick={handleTraitClick}
          onDeleteClick={confirmDelete}
          onCreateClick={() => setIsCreateDialogOpen(true)}
        />
      )}

      <CreateTraitDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateTrait={handleCreateTrait}
      />

      <DeleteTraitDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        traitToDelete={traitToDelete}
        onConfirmDelete={handleDeleteTrait}
      />
    </div>
  )
}
