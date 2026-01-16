import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as jose from "jose"

async function verifyAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (!token) return false

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "your-secret-key"
    )
    await jose.jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const isAuthenticated = await verifyAuth()
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const requestData = await request.json()

    const response = await fetch(
      `${process.env.ROOTARA_BACKEND_URL}/report/create`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.ROOTARA_BACKEND_API_KEY || "",
        },
        body: JSON.stringify(requestData),
      }
    )

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in report/create API:", error)
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    )
  }
}
