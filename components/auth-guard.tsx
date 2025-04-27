"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Sidebar } from "@/components/sidebar"
import { MainContent } from "@/components/main-content"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Skip redirect for login page to avoid redirect loops
    if (!isLoading && !user && pathname !== "/login") {
      router.push("/login")
    }
  }, [user, isLoading, router, pathname])

  // If on login page, don't show loading state or main layout
  if (pathname === "/login") {
    return <>{children}</>
  }

  // Show loading state for other pages
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If authenticated, show content with main layout
  if (user) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    )
  }

  // Otherwise show nothing while redirecting
  return null
}
