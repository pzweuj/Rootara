import * as jose from "jose"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"

export async function requireApiAuth(): Promise<NextResponse | null> {
  const token = (await cookies()).get("auth_token")?.value
  const secretValue = process.env.JWT_SECRET

  if (!token || !secretValue) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await jose.jwtVerify(token, new TextEncoder().encode(secretValue))
    return null
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function backendFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const backendUrl = process.env.ROOTARA_BACKEND_URL || DEFAULT_BACKEND_URL
  const headers = new Headers(init.headers)
  headers.set("x-api-key", process.env.ROOTARA_BACKEND_API_KEY || "")
  if (!headers.has("accept")) {
    headers.set("accept", "application/json")
  }

  return fetch(`${backendUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(60_000),
  })
}

export function backendError(
  response: Response,
  fallback = "Backend API error"
) {
  return new Error(`${fallback}: ${response.status} ${response.statusText}`)
}

/** Forward an upstream JSON/error response without turning its status into 500. */
export async function proxyBackendResponse(
  response: Response
): Promise<NextResponse> {
  const body = await response.text()
  const headers = new Headers()
  const contentType = response.headers.get("content-type")
  if (contentType) {
    headers.set("content-type", contentType)
  }
  return new NextResponse(
    body || JSON.stringify({ error: response.statusText }),
    {
      status: response.status,
      headers,
    }
  )
}

export function withApiAuth<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const unauthorized = await requireApiAuth()
    if (unauthorized) {
      return unauthorized
    }
    return handler(...args)
  }) as T
}
