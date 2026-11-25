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
      signal: request.signal,
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition":
          response.headers.get("Content-Disposition") || "attachment",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export const GET = POST
