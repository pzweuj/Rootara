"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

type User = {
  name: string
  email: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me")
        if (res.ok) {
          const userData = await res.json()
          setUser(userData)
        }
      } catch (error) {
        console.error("Failed to check authentication status", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      console.log("Attempting login for:", email)
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      console.log("Login response status:", res.status)

      if (!res.ok) {
        const errorData = await res.json()
        console.error("Login failed with error:", errorData)
        return false
      }

      const userData = await res.json()
      console.log("Login successful, user data:", userData)
      setUser(userData)

      // 立即验证cookie是否正确设置
      setTimeout(async () => {
        try {
          console.log("Verifying cookie after login...")
          const verifyRes = await fetch("/api/auth/me")
          console.log("Cookie verification status:", verifyRes.status)
          if (!verifyRes.ok) {
            console.error("Cookie verification failed - this may cause redirect issues")
          } else {
            console.log("Cookie verification successful")
          }
        } catch (error) {
          console.error("Cookie verification error:", error)
        }
      }, 100) // 短暂延迟确保cookie已设置

      return true
    } catch (error) {
      console.error("Login failed", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    console.log("Starting logout process")

    // 立即清除用户状态，提高响应速度
    setUser(null)

    try {
      // 异步清除服务器端cookie，不阻塞UI
      const logoutPromise = fetch("/api/auth/logout", {
        method: "POST",
      })

      // 立即跳转到登录页面，不等待服务器响应
      router.push("/login")

      // 等待服务器响应完成
      await logoutPromise
      console.log("Logout completed successfully")
    } catch (error) {
      console.error("Logout failed", error)
      // 即使服务器端logout失败，客户端状态已经清除，用户仍然会被重定向到登录页面
    }
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}
