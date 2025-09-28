import { NextRequest, NextResponse } from "next/server"

const API_BASE_URL = process.env.ROOTARA_BACKEND_URL || "http://0.0.0.0:8000"
const API_KEY =
  process.env.ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001"

export async function POST(request: NextRequest) {
  try {
    const { traitData } = await request.json()

    if (!traitData) {
      return NextResponse.json({ error: "缺少特征数据" }, { status: 400 })
    }

    // 转换格式适配后端
    // 辅助函数：安全地将对象转换为JSON字符串，避免重复序列化
    const safeStringify = (value: any): string => {
      if (typeof value === "string") {
        // 如果已经是字符串，检查是否是有效的JSON
        try {
          JSON.parse(value)
          return value // 已经是JSON字符串，直接返回
        } catch {
          return value // 不是JSON字符串，直接返回原字符串
        }
      } else if (typeof value === "object" && value !== null) {
        return JSON.stringify(value) // 是对象，序列化为JSON
      } else {
        return String(value) // 其他类型转换为字符串
      }
    }

    // 构建符合后端 TraitInput 模型的数据结构
    const backendTraitData = {
      name: safeStringify(traitData.name),
      description: safeStringify(traitData.description),
      scoreThresholds: safeStringify(traitData.scoreThresholds),
      icon: traitData.icon || "AlertCircle",
      confidence: traitData.confidence || "medium",
      category: traitData.category || "appearance",
      rsids: Array.isArray(traitData.rsids) ? traitData.rsids : [],
      formula: traitData.formula || "",
      result: safeStringify(traitData.result),
      reference: Array.isArray(traitData.reference)
        ? traitData.reference.reduce((acc: string[], item: string) => {
            // 如果元素包含逗号,则拆分成多个元素
            if (item.includes(",")) {
              return [...acc, ...item.split(",").map((s) => s.trim())]
            }
            return [...acc, item]
          }, [])
        : [],
    }

    console.log(
      "Original trait data received:",
      JSON.stringify(traitData, null, 2)
    )
    console.log(
      "Processed trait data to send to backend:",
      JSON.stringify(backendTraitData, null, 2)
    )

    const response = await fetch(`${API_BASE_URL}/traits/add`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendTraitData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Backend error response:", errorText)
      throw new Error(
        `API请求失败: ${response.status} ${response.statusText}. Details: ${errorText}`
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("创建特征失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
