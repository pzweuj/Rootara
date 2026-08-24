import { NextResponse } from "next/server"
import { backendFetch } from "@/lib/backend-client"

export async function POST(request: Request) {
  try {
    const { traits_id } = await request.json()

    const response = await backendFetch(
      `/traits/delete?traits_id=${encodeURIComponent(traits_id)}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in traits/delete API:", error)
    return NextResponse.json(
      { error: "Failed to delete trait" },
      { status: 500 }
    )
  }
}
