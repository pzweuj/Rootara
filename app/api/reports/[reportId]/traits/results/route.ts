import {
  backendFetch,
  proxyBackendResponse,
  requireApiAuth,
} from "@/lib/backend-client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const unauthorized = await requireApiAuth()
  if (unauthorized) {
    return unauthorized
  }

  const { reportId } = await params
  const response = await backendFetch(
    `/reports/${encodeURIComponent(reportId)}/traits/results`
  )
  return proxyBackendResponse(response)
}
