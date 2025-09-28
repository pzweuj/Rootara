import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = params

    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/report/${reportId}/rawdata`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-api-key": process.env.ROOTARA_BACKEND_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: "",
      }
    )

    if (!response.ok) {
      throw new Error("Failed to get raw data from backend")
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
