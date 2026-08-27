import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // Clear the auth cookie
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === "production"

    const cookieOptions: any = {
      name: "auth_token",
      value: "",
      expires: new Date(0),
      path: "/",
      httpOnly: true,
      secure: false, // 与login保持一致
      sameSite: "lax",
    }

    // 如果是生产环境且使用HTTPS，则启用secure
    if (isProduction && request.headers.get("x-forwarded-proto") === "https") {
      cookieOptions.secure = true
      cookieOptions.sameSite = "strict"
    }

    cookieStore.set(cookieOptions)

    return NextResponse.json({ success: true })
  } catch (error) {
    // 即使出错也返回成功，因为客户端状态已经清除
    return NextResponse.json({ success: true })
  }
}
