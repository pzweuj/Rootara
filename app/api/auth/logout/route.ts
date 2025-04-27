import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  // Clear the auth cookie
  cookies().delete("auth_token")

  return NextResponse.json({ success: true })
}
