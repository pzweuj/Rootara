import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import * as jose from "jose"

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === "/login"

  // Get the token from the cookies
  const token = request.cookies.get("auth_token")?.value || ""

  // If the path is public and the user is logged in, redirect to home
  if (isPublicPath && token) {
    try {
      // Verify the token using jose instead of jsonwebtoken
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key")
      await jose.jwtVerify(token, secret)
      return NextResponse.redirect(new URL("/", request.url))
    } catch (error) {
      // If token verification fails, continue to login page
    }
  }

  // If the path is not public and the user is not logged in, redirect to login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (API routes that handle authentication)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
