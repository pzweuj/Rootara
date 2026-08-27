import { NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { reportId } = await params

    const response = await backendFetch(`/report/${reportId}/rawdata`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: "",
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
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
