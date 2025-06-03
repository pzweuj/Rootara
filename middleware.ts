import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import * as jose from "jose"

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProduction = process.env.NODE_ENV === "production"

  // 在开发环境中添加调试日志
  if (!isProduction) {
    console.log(`[Middleware] Processing path: ${path}`)
  }

  // Define public paths that don't require authentication
  const isPublicPath = path === "/login"

  // Get the token from the cookies
  const token = request.cookies.get("auth_token")?.value || ""

  if (!isProduction) {
    console.log(`[Middleware] Public path: ${isPublicPath}, Has token: ${!!token}`)
  }

  // If the path is public and the user is logged in, redirect to home
  if (isPublicPath && token) {
    try {
      // Verify the token using jose instead of jsonwebtoken
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key")
      await jose.jwtVerify(token, secret)

      if (!isProduction) {
        console.log(`[Middleware] Valid token found, redirecting to home`)
      }

      return NextResponse.redirect(new URL("/", request.url))
    } catch (error) {
      // If token verification fails, continue to login page
      if (!isProduction) {
        console.log(`[Middleware] Token verification failed:`, error instanceof Error ? error.message : error)
      }

      // 清除无效的token cookie
      const response = NextResponse.next()
      response.cookies.set("auth_token", "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax"
      })
      return response
    }
  }

  // If the path is not public and the user is not logged in, redirect to login
  if (!isPublicPath && !token) {
    if (!isProduction) {
      console.log(`[Middleware] No token for protected path, redirecting to login`)
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // If the path is not public and there is a token, verify it
  if (!isPublicPath && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key")
      await jose.jwtVerify(token, secret)

      if (!isProduction) {
        console.log(`[Middleware] Token verified for protected path`)
      }
    } catch (error) {
      if (!isProduction) {
        console.log(`[Middleware] Invalid token for protected path, redirecting to login`)
      }

      // 清除无效的token并重定向到登录页面
      const response = NextResponse.redirect(new URL("/login", request.url))
      response.cookies.set("auth_token", "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax"
      })
      return response
    }
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
