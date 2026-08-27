import { NextResponse } from "next/server"

import { backendFetch } from "@/lib/backend-client"

export async function GET() {
  try {
    const response = await backendFetch("/health")
    const payload = await response.json().catch(() => ({ status: "unknown" }))
    const traitCatalog = payload?.checks?.trait_catalog || null
    return NextResponse.json(
      {
        status: response.ok ? "healthy" : "degraded",
        version: process.env.ROOTARA_VERSION || "1.0.0",
        backend: payload,
        traitCatalog,
      },
      { status: response.ok ? 200 : 503 }
    )
  } catch {
    return NextResponse.json(
      { status: "unhealthy", version: process.env.ROOTARA_VERSION || "1.0.0" },
      { status: 503 }
    )
  }
}
