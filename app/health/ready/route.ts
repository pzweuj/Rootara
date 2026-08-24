import { NextResponse } from "next/server"

import { backendFetch } from "@/lib/backend-client"

export async function GET() {
  try {
    const response = await backendFetch("/health/ready")
    const payload = await response.json().catch(() => ({ status: "unknown" }))
    return NextResponse.json(
      { status: response.ok ? "ready" : "not_ready", backend: payload },
      { status: response.ok ? 200 : 503 }
    )
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503 })
  }
}
