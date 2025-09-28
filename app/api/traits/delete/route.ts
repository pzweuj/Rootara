import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { traits_id } = await request.json()

    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/traits/delete?traits_id=${traits_id}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-api-key": process.env.ROOTARA_BACKEND_API_KEY || "",
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
