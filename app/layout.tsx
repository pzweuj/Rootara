import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { TopNav } from "@/components/top-nav"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SettingsProvider } from "@/contexts/settings-context"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { LanguageProvider } from "@/contexts/language-context"
import { cn } from "@/lib/utils"
import type React from "react"

const inter = Inter({ subsets: ["latin"] })

function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()

  return (
    <div
      className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        // 在桌面视图中始终使用展开状态的边距，在移动视图中根据 isCollapsed 状态调整
        "ml-72 lg:ml-72",
        isCollapsed ? "ml-[72px]" : "ml-72",
        "lg:translate-x-0",
      )}
    >
      <TopNav />
      <div className="container mx-auto p-6 max-w-7xl">
        <main className="w-full">{children}</main>
      </div>
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SettingsProvider>
            <LanguageProvider>
              <SidebarProvider>
                <TooltipProvider delayDuration={0}>
                  <div className="min-h-screen flex">
                    <Sidebar />
                    <MainContent>{children}</MainContent>
                  </div>
                </TooltipProvider>
              </SidebarProvider>
            </LanguageProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'

export const metadata = {
      generator: 'v0.dev'
    };
