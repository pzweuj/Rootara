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
    // 从请求中获取参数
    const requestData = await request.json()
    const { report_id, sort_by, sort_order, search_term, filters, indel } =
      requestData

    if (!report_id) {
      return NextResponse.json({ error: "缺少报告ID" }, { status: 400 })
    }

    // 调用后端API
    const response = await backendFetch(`/report/clinvar`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        report_id,
        sort_by: sort_by || "",
        sort_order: sort_order || "asc",
        search_term: search_term || "",
        filters: filters || {},
        indel: indel || false,
      }),
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
    }

    // 获取并返回数据
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("获取ClinVar数据失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
