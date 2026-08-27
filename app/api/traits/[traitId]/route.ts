import { NextRequest } from "next/server"

import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ traitId: string }> }
) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  const reportId = request.nextUrl.searchParams.get("report_id")
  if (!reportId) {
    return Response.json({ error: "report_id is required" }, { status: 400 })
  }
  const { traitId } = await params
  const response = await backendFetch(
    `/traits/${encodeURIComponent(traitId)}?report_id=${encodeURIComponent(reportId)}`
  )
  return proxyBackendResponse(response)
}
