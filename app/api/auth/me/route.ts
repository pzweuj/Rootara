import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export async function GET() {
  try {
    // Get the token from cookies
    const token = (await cookies()).get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Verify the token using jose
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    // Return user data
    return NextResponse.json(payload)
  } catch (error) {
    console.error("Auth verification error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
  }
}
