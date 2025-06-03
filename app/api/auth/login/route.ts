import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"

// In a real app, you would use a database
// For this example, we'll use environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const JWT_SECRET = process.env.JWT_SECRET

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    console.log("Login attempt for email:", email)
    console.log("Environment check:", {
      hasAdminEmail: !!process.env.ADMIN_EMAIL,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV
    })

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
      console.error("Missing environment variables")
      return NextResponse.json({ error: "Missing environment variables" }, { status: 500 })
    }

    // Validate credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      console.log("Invalid credentials provided")
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Create user object
    const user = {
      // 从邮箱地址中提取用户名部分作为name
      name: ADMIN_EMAIL?.split('@')[0] || "Admin",
      email: ADMIN_EMAIL,
    }

    // Create JWT token using jose
    const secret = new TextEncoder().encode(JWT_SECRET)
    const token = await new jose.SignJWT(user)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .setIssuedAt()
      .sign(secret)

    // Set HTTP-only cookie with improved settings for different environments
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === "production"

    cookieStore.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax", // 在开发环境使用lax，生产环境使用strict
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours to match JWT expiration
    })

    console.log("Login successful for user:", user.email)
    return NextResponse.json(user)
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
