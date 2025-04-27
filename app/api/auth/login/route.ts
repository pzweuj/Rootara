import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"

// In a real app, you would use a database
// For this example, we'll use environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123"
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

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
    cookies().set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
