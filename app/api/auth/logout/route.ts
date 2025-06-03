import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    console.log("Processing logout request")

    // Clear the auth cookie
    const cookieStore = await cookies()
    cookieStore.set("auth_token", "", {
      expires: new Date(0),
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax"
    })

    console.log("Logout successful - cookie cleared")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    // 即使出错也返回成功，因为客户端状态已经清除
    return NextResponse.json({ success: true })
  }
}
