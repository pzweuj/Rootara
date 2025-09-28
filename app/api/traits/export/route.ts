import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { traits } = await request.json()

    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/traits/export`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ROOTARA_BACKEND_API_KEY || "",
        },
        body: JSON.stringify(traits),
      }
    )

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
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
