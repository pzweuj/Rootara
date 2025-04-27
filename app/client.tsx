"use client"

import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider } from "@/components/sidebar-context"
import { LanguageProvider } from "@/contexts/language-context"
import { AuthProvider } from "@/contexts/auth-context"
import { AuthGuard } from "@/components/auth-guard"
import type React from "react"
import { MainContent } from "@/components/main-content"
import { usePathname } from "next/navigation"

const inter = Inter({ subsets: ["latin"] })

export default function ClientRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <LanguageProvider>
              <SidebarProvider>
                <TooltipProvider delayDuration={0}>
                  <AuthGuard>
                    <LayoutContent>{children}</LayoutContent>
                  </AuthGuard>
                </TooltipProvider>
              </SidebarProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

// 创建一个条件渲染组件来处理不同路径的布局
function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // 如果是登录页面，只渲染子组件
  if (pathname === "/login") {
    return <>{children}</>
  }

  // 否则渲染带有侧边栏的主布局
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <MainContent>{children}</MainContent>
    </div>
  )
}
