import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export async function GET() {
  try {
    console.log("Checking authentication status")

    // Get the token from cookies
    const token = (await cookies()).get("auth_token")?.value

    if (!token) {
      console.log("No auth token found in cookies")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("Auth token found, verifying...")

    // Verify the token using jose
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    console.log("Token verified successfully for user:", payload.email)

    // Return user data
    return NextResponse.json(payload)
  } catch (error) {
    console.error("Auth verification error:", error)
    if (error instanceof jose.errors.JWTExpired) {
      console.log("JWT token has expired")
    } else if (error instanceof jose.errors.JWTInvalid) {
      console.log("JWT token is invalid")
    }
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    )
  }
}
