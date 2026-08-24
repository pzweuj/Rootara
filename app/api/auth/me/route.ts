import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import * as jose from "jose"

export async function GET() {
  const token = (await cookies()).get("auth_token")?.value
  const jwtSecret = process.env.JWT_SECRET
  if (!token || !jwtSecret) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { payload } = await jose.jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret)
    )
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
  }
}
