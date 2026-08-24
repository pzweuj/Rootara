import { NextRequest, NextResponse } from "next/server"
import { backendFetch } from "@/lib/backend-client"

export async function POST(request: NextRequest) {
  try {
    // 从请求中获取报告ID
    const { reportId } = await request.json()

    if (!reportId) {
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
        report_id: reportId,
        sort_by: "",
        sort_order: "asc",
        search_term: "",
        filters: {},
        indel: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
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
