import { NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST() {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const response = await backendFetch("/user/id", {
      method: "POST",
      headers: {
        accept: "application/json",
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      return proxyBackendResponse(response)
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
