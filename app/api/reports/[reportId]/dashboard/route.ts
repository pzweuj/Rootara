import {
  backendFetch,
  proxyBackendResponse,
  withApiAuth,
} from "@/lib/backend-client"

export const GET = withApiAuth(
  async (
    _request: Request,
    { params }: { params: Promise<{ reportId: string }> }
  ) => {
    const { reportId } = await params
    return proxyBackendResponse(
      await backendFetch(`/reports/${encodeURIComponent(reportId)}/dashboard`)
    )
  }
)
