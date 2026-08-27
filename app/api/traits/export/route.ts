import { NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST() {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const response = await backendFetch("/traits/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "",
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
    }

    const data = await response.json()

    // 创建格式化的JSON字符串，使用2个空格缩进
    const formattedJson = JSON.stringify(data, null, 2)

    // 返回格式化的JSON作为文件下载
    return new NextResponse(formattedJson, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="traits-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Error in traits/export API:", error)
    return NextResponse.json(
      { error: "Failed to export traits" },
      { status: 500 }
    )
  }
}
