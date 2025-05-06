import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"

// In a real app, you would use a database
// For this example, we'll use environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@rootara.app"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "rootara123"
const JWT_SECRET = process.env.JWT_SECRET || "FPFj&WXSXV5t4v6Zr93hxxnG#R*x"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // Validate credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Create user object
    const user = {
      name: "Admin", // You can customize this or extract from email
      email: ADMIN_EMAIL,
    }

    // Create JWT token using jose
    const secret = new TextEncoder().encode(JWT_SECRET)
    const token = await new jose.SignJWT(user).setProtectedHeader({ alg: "HS256" }).setExpirationTime("8h").sign(secret)

    // Set HTTP-only cookie
    // Set HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 4 * 60 * 60, // 4 hours
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
