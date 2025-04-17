import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SettingsProvider } from "@/contexts/settings-context"
import { SidebarProvider } from "@/components/sidebar-context"
import { LanguageProvider } from "@/contexts/language-context"
import type React from "react"
import { MainContent } from "@/components/main-content"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  generator: "pzweuj",
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