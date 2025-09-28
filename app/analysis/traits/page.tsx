"use client"

import type React from "react"
import type { Trait, TraitCategory } from "@/types/trait"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { loadAllTraits } from "@/lib/trait-utils"
import { TraitFilters } from "./components/trait-filters"
import { TraitsList } from "./components/trait-list"
import { CreateTraitDialog } from "./components/create-trait-dialog"
import { DeleteTraitDialog } from "./components/delete-trait-dialog"
import { TraitImportExport } from "./components/trait-import-export"
import { Card, CardContent } from "@/components/ui/card"
import { useReport } from "@/contexts/report-context" // 导入报告上下文



export default function TraitsPage() {
  const { language, t } = useLanguage()
  const router = useRouter()
  const { currentReportId } = useReport() // 使用报告上下文获取当前报告ID
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TraitCategory>("all")
  const [traits, setTraits] = useState<Trait[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [traitToDelete, setTraitToDelete] = useState<Trait | null>(null)

  // Cache management using sessionStorage
  const getCacheKey = (reportId: string) => `traits_cache_${reportId}`
  const getTimestampKey = (reportId: string) => `traits_timestamp_${reportId}`

  // Function to get cached data
  const getCachedTraits = (reportId: string): Trait[] | null => {
    if (typeof window === "undefined") return null
    try {
      const cached = sessionStorage.getItem(getCacheKey(reportId))
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error("Failed to get cached traits:", error)
      return null
    }
  }

  // Function to set cached data
  const setCachedTraits = (reportId: string, traits: Trait[]) => {
    if (typeof window === "undefined") return
    try {
      sessionStorage.setItem(getCacheKey(reportId), JSON.stringify(traits))
      sessionStorage.setItem(getTimestampKey(reportId), Date.now().toString())
    } catch (error) {
      console.error("Failed to cache traits:", error)
    }
  }

  // Function to check if we need to refresh (for forced refresh scenarios)
  const shouldForceRefresh = (reportId: string): boolean => {
    if (typeof window === "undefined") return true
    const forceRefreshKey = `traits_force_refresh_${reportId}`
    const shouldRefresh = sessionStorage.getItem(forceRefreshKey) === "true"
    if (shouldRefresh) {
      sessionStorage.removeItem(forceRefreshKey)
    }
    return shouldRefresh
  }

  // Function to mark for forced refresh
  const markForRefresh = (reportId: string) => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(`traits_force_refresh_${reportId}`, "true")
  }

  // Function to refresh traits data from API
  const refreshTraitsData = async (reportId: string) => {
    try {
      const allTraits = await loadAllTraits(reportId)
      setTraits(allTraits)
      setCachedTraits(reportId, allTraits)
    } catch (error) {
      console.error("Failed to load traits:", error)
      setTraits([])
    }
  }

  // Load traits on component mount and when report ID changes
  useEffect(() => {
    const loadTraitsData = async () => {
      if (!currentReportId) return

      // Check if we have cached data
      const cachedTraits = getCachedTraits(currentReportId)
      const forceRefresh = shouldForceRefresh(currentReportId)

      if (cachedTraits && !forceRefresh) {
        // Use cached data
        setTraits(cachedTraits)
      } else {
        // Fetch from API
        await refreshTraitsData(currentReportId)
      }
    }

    loadTraitsData()
  }, [currentReportId])

  // Filter traits based on search query and selected category
  const filteredTraits = traits.filter((trait) => {
    const matchesSearch = trait.name[language as keyof typeof trait.name]
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || trait.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Handle trait card click - navigate to detail page
  const handleTraitClick = (trait: Trait) => {
    router.push(`/analysis/traits/${trait.id}`)
  }

  // Handle creating a new trait
  const handleCreateTrait = async (newTrait: Trait) => {
    setIsCreateDialogOpen(false)

    toast.success(
      language === "en"
        ? `Trait created successfully with result: ${newTrait.result.en}`
        : `特征创建成功，结果为：${newTrait.result["zh-CN"]}`,
    )

    // Case 3: Refresh traits list from backend after creating a new trait
    if (currentReportId) {
      markForRefresh(currentReportId)
      await refreshTraitsData(currentReportId)
    }
  }

  // Handle deleting a trait
  const handleDeleteTrait = async () => {
    if (!traitToDelete) return

    setIsDeleteDialogOpen(false)
    setTraitToDelete(null)

    toast.success(t("traitDeletedSuccessfully"))

    // Case 4: Refresh traits list from backend after deleting a trait
    if (currentReportId) {
      markForRefresh(currentReportId)
      await refreshTraitsData(currentReportId)
    }
  }

  // Open delete confirmation dialog
  const confirmDelete = (e: React.MouseEvent, trait: Trait) => {
    e.stopPropagation() // Prevent card click
    setTraitToDelete(trait)
    setIsDeleteDialogOpen(true)
  }

  // Handle importing traits
  const handleImportTraits = async (_importedTraits: Trait[]) => {
    // Case 5: Refresh traits list from backend after importing traits
    // Note: We refresh from backend instead of using importedTraits to ensure data consistency
    if (currentReportId) {
      markForRefresh(currentReportId)
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
        <TraitImportExport onImport={handleImportTraits} traits={traits} />
      </div>

      <TraitsList
        traits={filteredTraits}
        onTraitClick={handleTraitClick}
        onDeleteClick={confirmDelete}
        onCreateClick={() => setIsCreateDialogOpen(true)}
      />

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
