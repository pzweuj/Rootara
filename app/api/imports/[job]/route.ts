import { backendFetch, withApiAuth } from "@/lib/backend-client"

type Context = { params: Promise<{ job: string }> }
const forward = withApiAuth(async (request: Request, { params }: Context) => {
  const { job } = await params
  const init: RequestInit & { duplex?: "half" } = { method: request.method }
  if (request.method === "POST") {
    init.body = request.body
    init.duplex = "half"
  }
  const response = await backendFetch(
    `/imports/${encodeURIComponent(job)}${new URL(request.url).search}`,
    init
  )
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
})

export const POST = forward
export const GET = forward
