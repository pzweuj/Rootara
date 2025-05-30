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
      jsonData.forEach((trait: any, index: number) => {
        // 检查必需的基本属性
        if (!trait.id || typeof trait.id !== "string") {
          throw new Error(`Trait at index ${index}: Missing or invalid 'id' field.`);
        }

        // 验证多语言对象结构
        const validateMultiLangObject = (obj: any, fieldName: string, isOptional = false) => {
          if (!obj || typeof obj !== "object") {
            if (isOptional) {
              return; // 可选字段，跳过验证
            }
            throw new Error(`Trait at index ${index}: '${fieldName}' must be an object.`);
          }
          if (typeof obj.en !== "string" || typeof obj["zh-CN"] !== "string" || typeof obj.default !== "string") {
            throw new Error(`Trait at index ${index}: '${fieldName}' must have 'en', 'zh-CN', and 'default' string properties.`);
          }
        };

        // 验证必需的多语言字段
        validateMultiLangObject(trait.name, "name");
        validateMultiLangObject(trait.description, "description");

        // result_current 是可选的，因为导出的文件可能不包含这个字段（它是动态计算的）
        validateMultiLangObject(trait.result_current, "result_current", true);

        // 验证 result 字段 - 这是一个复杂的嵌套对象结构
        if (!trait.result || typeof trait.result !== "object") {
          throw new Error(`Trait at index ${index}: 'result' must be an object.`);
        }

        // 验证 result 对象中的每个键都有正确的多语言结构
        Object.entries(trait.result).forEach(([key, value]: [string, any]) => {
          if (!value || typeof value !== "object") {
            throw new Error(`Trait at index ${index}: 'result.${key}' must be an object.`);
          }
          if (typeof value.en !== "string" || typeof value["zh-CN"] !== "string" || typeof value.default !== "string") {
            throw new Error(`Trait at index ${index}: 'result.${key}' must have 'en', 'zh-CN', and 'default' string properties.`);
          }
        });

        // 验证其他必需字段
        if (typeof trait.category !== "string") {
          throw new Error(`Trait at index ${index}: 'category' must be a string.`);
        }

        if (!Array.isArray(trait.rsids)) {
          throw new Error(`Trait at index ${index}: 'rsids' must be an array.`);
        }

        // referenceGenotypes 和 yourGenotypes 是可选的，因为导出的文件可能不包含这些字段
        if (trait.referenceGenotypes !== undefined && !Array.isArray(trait.referenceGenotypes)) {
          throw new Error(`Trait at index ${index}: 'referenceGenotypes' must be an array if present.`);
        }

        if (trait.yourGenotypes !== undefined && !Array.isArray(trait.yourGenotypes)) {
          throw new Error(`Trait at index ${index}: 'yourGenotypes' must be an array if present.`);
        }

        if (typeof trait.formula !== "string") {
          throw new Error(`Trait at index ${index}: 'formula' must be a string.`);
        }

        if (!trait.scoreThresholds || typeof trait.scoreThresholds !== "object") {
          throw new Error(`Trait at index ${index}: 'scoreThresholds' must be an object.`);
        }

        if (typeof trait.icon !== "string") {
          throw new Error(`Trait at index ${index}: 'icon' must be a string.`);
        }

        if (typeof trait.confidence !== "string") {
          throw new Error(`Trait at index ${index}: 'confidence' must be a string.`);
        }

        if (typeof trait.isDefault !== "boolean") {
          throw new Error(`Trait at index ${index}: 'isDefault' must be a boolean.`);
        }

        if (typeof trait.createdAt !== "string") {
          throw new Error(`Trait at index ${index}: 'createdAt' must be a string.`);
        }

        if (!Array.isArray(trait.reference)) {
          throw new Error(`Trait at index ${index}: 'reference' must be an array.`);
        }
      });

      // 为导入的特征添加缺失的可选字段的默认值
      const processedTraits = jsonData.map((trait: any) => ({
        ...trait,
        // 如果 result_current 不存在，创建一个默认的空对象
        result_current: trait.result_current || {
          en: "",
          "zh-CN": "",
          default: ""
        },
        // 如果 referenceGenotypes 不存在，创建空数组
        referenceGenotypes: trait.referenceGenotypes || [],
        // 如果 yourGenotypes 不存在，创建空数组
        yourGenotypes: trait.yourGenotypes || []
      }));

      // 调用新的API路由
      const response = await fetch('/api/traits/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_data: JSON.stringify(processedTraits) })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const importedTraits = processedTraits as Trait[];
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
