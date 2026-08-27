import { createHash, createHmac, timingSafeEqual } from "crypto"

import * as jose from "jose"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

function passwordDigest(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex")
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

export async function POST(request: Request) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@rootara.app"
    const adminPassword = process.env.ADMIN_PASSWORD
    const jwtSecret = process.env.JWT_SECRET
    if (!adminPassword || !jwtSecret) {
      return NextResponse.json(
        { error: "Authentication is not configured" },
        { status: 503 }
      )
    }

    const { email, password } = await request.json()
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const expectedDigest = createHmac("sha256", jwtSecret)
      .update(passwordDigest(adminPassword))
      .digest("hex")
    const receivedDigest = createHmac("sha256", jwtSecret)
      .update(passwordDigest(password))
      .digest("hex")

    if (email !== adminEmail || !secureEqual(receivedDigest, expectedDigest)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const user = {
      name: adminEmail.split("@", 1)[0] || "Admin",
      email: adminEmail,
    }
    const token = await new jose.SignJWT(user)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .setIssuedAt()
      .sign(new TextEncoder().encode(jwtSecret))

    const isHttps = request.headers.get("x-forwarded-proto") === "https"
    ;(await cookies()).set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && isHttps,
      sameSite:
        process.env.NODE_ENV === "production" && isHttps ? "strict" : "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    })

    return NextResponse.json(user)
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    )
  }
}
