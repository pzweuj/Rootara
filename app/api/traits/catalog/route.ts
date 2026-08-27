import { NextRequest, NextResponse } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  const headers = new Headers()
  const etag = request.headers.get("if-none-match")
  if (etag) {
    headers.set("if-none-match", etag)
  }
  const response = await backendFetch("/traits/catalog", { headers })
  if (response.status === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: response.headers.get("etag") || etag || "" },
    })
  }
  if (!response.ok) {
    return proxyBackendResponse(response)
  }
  const body = await response.text()
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, max-age=300, must-revalidate",
      ETag: response.headers.get("etag") || "",
    },
  })
}
