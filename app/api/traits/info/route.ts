import { NextRequest, NextResponse } from "next/server"

// 使用服务器端环境变量（不带NEXT_PUBLIC前缀）
const API_BASE_URL = process.env.ROOTARA_BACKEND_URL || "http://0.0.0.0:8000"
const API_KEY =
  process.env.ROOTARA_BACKEND_API_KEY || "rootara_api_key_default_001"

export async function POST(request: NextRequest) {
  try {
    // 从请求体中获取report_id，如果没有则从查询参数获取
    let reportId: string

    try {
      const body = await request.json()
      reportId = body.report_id
    } catch {
      // 如果解析JSON失败，尝试从查询参数获取
      reportId = request.nextUrl.searchParams.get("report_id") || ""
    }

    if (!reportId) {
      return NextResponse.json(
        { error: "report_id is required" },
        { status: 400 }
      )
    }

    // 调用后端API
    const response = await fetch(
      `${API_BASE_URL}/traits/info?report_id=${reportId}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-api-key": API_KEY,
        },
        body: "",
      }
    )

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in traits/info API:", error)
    return NextResponse.json(
      { error: "Failed to fetch traits data" },
      { status: 500 }
    )
  }
}
