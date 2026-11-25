import { NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function POST(request: Request) {
  try {
    const unauthorized = await requireApiAuth()
    if (unauthorized) {
      return unauthorized
    }

    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: request.body,
      duplex: "half",
      signal: request.signal,
    }
    return proxyBackendResponse(await backendFetch("/report/create", init))
  } catch (error) {
    console.error("Error in report/create API:", error)
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    )
  }
}
