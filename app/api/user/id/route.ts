import { NextResponse } from "next/server"
import { backendFetch } from "@/lib/backend-client"

export async function POST() {
  try {
    const response = await backendFetch("/user/id", {
      method: "POST",
      headers: {
        accept: "application/json",
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in user/id API:", error)
    return NextResponse.json(
      { error: "Failed to get user ID" },
      { status: 500 }
    )
  }
}
