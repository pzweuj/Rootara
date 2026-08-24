import { NextResponse } from "next/server"
import { backendFetch } from "@/lib/backend-client"

export async function POST(request: Request) {
  try {
    const response = await backendFetch(
      "/report/all",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "",
      }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch reports from backend")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
