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

// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_URL || "http://0.0.0.0:8000"
// API密钥
const API_KEY = process.env.NEXT_PUBLIC_ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001"

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
  
      // 发送到后端API
      const response = await fetch(`${API_BASE_URL}/traits/import?input_data=${encodeURIComponent(fileContent)}`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY
        },
        body: ''
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
    const userTraits = traits.filter((trait) => !trait.isDefault);
    if (userTraits.length === 0) {
      toast.warning(t("noCustomTraits"));
      return;
    }
  
    try {
      const now = new Date();
      const exportName = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.json`;
      
      const response = await fetch(`${API_BASE_URL}/traits/export`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(userTraits)
      });
    
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    
      const jsonString = await response.text();
      
      // 将JSON字符串保存为文件
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(t("exportSuccess"));
    } catch (error: any) {
      console.error("Error exporting traits:", error);
      toast.error(`Error exporting traits: ${error.message}`);
    }
  };

  return (
    <div className="flex gap-2">
      <input type="file" id="import-traits" className="hidden" accept=".json" onChange={handleImportTraits} />
      <Button
        variant="outline"
        size="icon"
        title={t("importTraits")}
        onClick={() => document.getElementById("import-traits")?.click()}
      >
        <Upload className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" title={t("exportTraits")} onClick={handleExportTraits}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  )
}
