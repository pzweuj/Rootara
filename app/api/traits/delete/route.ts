import { NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

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
      return proxyBackendResponse(response)
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
