"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { toast } from "sonner"
import type { Trait } from "@/types/trait"

interface DeleteTraitDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  traitToDelete: Trait | null
  onConfirmDelete: () => void
}

// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || "http://0.0.0.0:8000"
// API密钥
const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001"

export function DeleteTraitDialog({ isOpen, onOpenChange, traitToDelete, onConfirmDelete }: DeleteTraitDialogProps) {
  const { language } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)

  const translations = {
    en: {
      deleteConfirmation: "Delete Confirmation",
      deleteTraitQuestion: "Are you sure you want to delete this trait?",
      thisActionCannot: "This action cannot be undone.",
      cancel: "Cancel",
      delete: "Delete",
      deleting: "Deleting...",
      errorDeleting: "Error deleting trait",
    },
    "zh-CN": {
      deleteConfirmation: "删除确认",
      deleteTraitQuestion: "您确定要删除这个特征吗？",
      thisActionCannot: "此操作无法撤销。",
      cancel: "取消",
      delete: "删除",
      deleting: "正在删除...",
      errorDeleting: "删除特征时出错",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  const handleDelete = async () => {
    if (!traitToDelete) return
    
    try {
      setIsLoading(true)
      toast.loading(language === 'en' ? 'Deleting trait...' : '正在删除特征...')
      
      // 调用后端API删除特征
      const response = await fetch(`${API_BASE_URL}/traits/delete?traits_id=${traitToDelete.id}`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY
        }
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      await response.json()
      
      // 通知父组件删除成功
      onConfirmDelete()
      toast.dismiss()
      toast.success(language === 'en' ? 'Trait deleted successfully' : '特征删除成功')
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting trait:', error)
      toast.dismiss()
      toast.error(t("errorDeleting"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmation")}</DialogTitle>
          <DialogDescription>
            {t("deleteTraitQuestion")} {t("thisActionCannot")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
