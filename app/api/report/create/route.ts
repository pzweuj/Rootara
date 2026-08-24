import { NextResponse } from "next/server"
import { backendFetch, requireApiAuth } from "@/lib/backend-client"

export async function POST(request: Request) {
  try {
    const unauthorized = await requireApiAuth()
    if (unauthorized) return unauthorized

    const requestData = await request.json()

    const response = await backendFetch(
      "/report/create",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      }
    )

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in report/create API:", error)
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    )
  }
}
