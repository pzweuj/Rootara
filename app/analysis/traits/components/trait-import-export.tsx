"use client"

import type React from "react"
import { Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { toast } from "sonner"
import type { Trait } from "@/types/trait"

interface TraitImportExportProps {
  onImport: (traits: Trait[]) => void
  traits: Trait[]
}

export function TraitImportExport({ onImport, traits }: TraitImportExportProps) {
  const { language } = useLanguage()

  const translations = {
    en: {
      importTraits: "Import Traits",
      exportTraits: "Export Traits",
      importSuccess: "Traits imported successfully",
      importError: "Error importing traits",
      noCustomTraits: "No custom traits to export",
      exportSuccess: "Traits exported successfully",
      noFileSelected: "No file selected",
    },
    "zh-CN": {
      importTraits: "导入特征",
      exportTraits: "导出特征",
      importSuccess: "特征导入成功",
      importError: "导入特征时出错",
      noCustomTraits: "没有自定义特征可导出",
      exportSuccess: "特征导出成功",
      noFileSelected: "未选择文件",
    },
  }

  const t = (key: keyof typeof translations.en) => translations[language as keyof typeof translations][key] || key

  const handleImportTraits = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error(t("noFileSelected"));
      return;
    }

    try {
      const fileContent = await file.text();
      const jsonData = JSON.parse(fileContent);

      if (!Array.isArray(jsonData)) {
        throw new Error("Uploaded file does not contain an array of traits.");
      }

      // 验证每个特征对象
      jsonData.forEach((trait: any) => {
        if (
          typeof trait.name !== "object" ||
          typeof trait.description !== "object" ||
          typeof trait.category !== "string" ||
          !Array.isArray(trait.rsids) ||
          !Array.isArray(trait.referenceGenotypes) ||
          !Array.isArray(trait.yourGenotypes) ||
          typeof trait.formula !== "string" ||
          typeof trait.scoreThresholds !== "object"
        ) {
          throw new Error("Invalid trait format in the uploaded file.");
        }
      });

      // 调用新的API路由
      const response = await fetch('/api/traits/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_data: fileContent })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const importedTraits = jsonData as Trait[];
      onImport(importedTraits);
      toast.success(t("importSuccess"));
    } catch (error: any) {
      console.error("Error importing traits:", error);
      toast.error(`${t("importError")}: ${error.message}`);
    }
  };

  const handleExportTraits = async () => {
    // 过滤出非默认特征（用户创建的特征）
    const customTraits = traits.filter((trait) => !trait.isDefault)

    if (customTraits.length === 0) {
      toast.error(t("noCustomTraits"));
      return;
    }

    try {
      // 调用新的API路由
      const response = await fetch('/api/traits/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ traits: customTraits })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 获取文件名从响应头
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `traits-export-${new Date().toISOString().split('T')[0]}.json`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // 获取格式化的JSON文本
      const formattedJson = await response.text()

      // 创建下载链接
      const blob = new Blob([formattedJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(t("exportSuccess"));
    } catch (error: any) {
      console.error("Error exporting traits:", error);
      toast.error(`Error exporting traits: ${error.message}`);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleExportTraits}
        title={t("exportTraits")}
        size="icon"
      >
        <Download className="h-4 w-4" />
      </Button>
      <input type="file" id="import-traits" className="hidden" accept=".json" onChange={handleImportTraits} />
      <Button
        variant="outline"
        size="icon"
        title={t("importTraits")}
        onClick={() => document.getElementById("import-traits")?.click()}
      >
        <Upload className="h-4 w-4" />
      </Button>
    </div>
  )
}
