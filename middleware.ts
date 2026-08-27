import * as jose from "jose"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProduction = process.env.NODE_ENV === "production"

  // 在开发环境中添加调试日志
  if (!isProduction) {
    console.log(`[Middleware] Processing path: ${path}`)
  }

  // Login, logout and health probes are intentionally public. API routes use
  // JSON 401 responses so clients never receive an HTML redirect.
  const isPublicPath =
    path === "/login" ||
    path === "/health" ||
    path.startsWith("/health/") ||
    path === "/api/auth/login" ||
    path === "/api/auth/logout"
  const redirectAuthenticated = path === "/login"
  const isApiPath = path.startsWith("/api/")

  // Get the token from the cookies
  const token = request.cookies.get("auth_token")?.value || ""

  if (!isProduction) {
    console.log(
      `[Middleware] Public path: ${isPublicPath}, Has token: ${!!token}`
    )
  }

  // If the path is public and the user is logged in, redirect to home
  if (redirectAuthenticated && token) {
    try {
      // Verify the token using jose instead of jsonwebtoken
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "")
      await jose.jwtVerify(token, secret)

      if (!isProduction) {
        console.log(`[Middleware] Valid token found, redirecting to home`)
      }

      return NextResponse.redirect(new URL("/", request.url))
    } catch (error) {
      // If token verification fails, continue to login page
      if (!isProduction) {
        console.log(
          `[Middleware] Token verification failed:`,
          error instanceof Error ? error.message : error
        )
      }

      // 清除无效的token cookie
      const response = NextResponse.next()
      response.cookies.set("auth_token", "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: false, // 与login API保持一致
        sameSite: "lax",
      })
      return response
    }
  }

  // If the path is not public and the user is not logged in, redirect to login
  if (!isPublicPath && !token) {
    if (!isProduction) {
      console.log(
        `[Middleware] No token for protected path, redirecting to login`
      )
    }
    return isApiPath
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url))
  }

  // If the path is not public and there is a token, verify it
  if (!isPublicPath && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "")
      await jose.jwtVerify(token, secret)

      if (!isProduction) {
        console.log(`[Middleware] Token verified for protected path`)
      }
    } catch (error) {
      if (!isProduction) {
        console.log(
          `[Middleware] Invalid token for protected path, redirecting to login`
        )
      }

      // 清除无效的token并重定向到登录页面
      const response = isApiPath
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url))
      response.cookies.set("auth_token", "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: false, // 与login API保持一致
        sameSite: "lax",
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
     * Match all request paths except for static assets. Authentication routes
     * are handled explicitly above so API callers receive JSON 401 responses.
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - *.ico (all ico files)
     * - *.png, *.jpg, *.jpeg, *.gif, *.svg (static images)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.ico$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)",
  ],
}
