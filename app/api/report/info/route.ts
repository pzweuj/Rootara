import { NextRequest, NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  try {
    // 从请求中获取报告ID
    const { reportId } = await request.json()

    if (!reportId) {
      return NextResponse.json({ error: "缺少报告ID" }, { status: 400 })
    }

    // 调用后端API
    const response = await backendFetch(`/report/${reportId}/info`, {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
    }

    // 获取并返回数据
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("获取报告信息失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
