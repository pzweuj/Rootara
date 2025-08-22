import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"
// @ts-ignore
const { createHmac } = require('crypto')

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

    // First hash the stored password with SHA-256, then apply HMAC with JWT_SECRET
    const encoder = new TextEncoder()
    const storedPasswordData = encoder.encode(ADMIN_PASSWORD)
    const storedPasswordHash = await crypto.subtle.digest('SHA-256', storedPasswordData)
    const storedPasswordHashArray = Array.from(new Uint8Array(storedPasswordHash))
    const storedPasswordHashHex = storedPasswordHashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Apply HMAC with JWT_SECRET to both passwords
    const hashedPassword = createHmac('sha256', JWT_SECRET)
      .update(password)
      .digest('hex')
    
    const hashedStoredPassword = createHmac('sha256', JWT_SECRET)
      .update(storedPasswordHashHex)
      .digest('hex')
    
    // Validate credentials
    if (email !== ADMIN_EMAIL || hashedPassword !== hashedStoredPassword) {
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

    // 获取请求的host信息来设置正确的cookie domain
    const host = request.headers.get('host')
    console.log("Request host:", host)

    let cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax" | "strict";
      path: string;
      maxAge: number;
    } = {
      httpOnly: true,
      secure: false, // 在VPS环境中暂时禁用secure，因为可能没有HTTPS
      sameSite: "lax", // 使用lax以确保跨域兼容性
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours to match JWT expiration
    }

    // 如果是生产环境且使用HTTPS，则启用secure
    if (isProduction && request.headers.get('x-forwarded-proto') === 'https') {
      cookieOptions.secure = true
      cookieOptions.sameSite = "strict"
    }

    console.log("Setting cookie with options:", cookieOptions)
    cookieStore.set("auth_token", token, cookieOptions)

    console.log("Login successful for user:", user.email)
    return NextResponse.json(user)
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
