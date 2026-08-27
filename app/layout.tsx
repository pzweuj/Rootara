import "./globals.css"
import { Inter } from "next/font/google"
import type React from "react"

import { AuthGuard } from "@/components/auth-guard"
import { SidebarProvider } from "@/components/sidebar-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/contexts/auth-context"
import { LanguageProvider } from "@/contexts/language-context"
import { ReportProvider } from "@/contexts/report-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Rootara",
  author: "pzweuj",
  generator: "pzweuj",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
          <AuthProvider>
            <LanguageProvider>
              <ReportProvider>
                <SidebarProvider>
                  <TooltipProvider delayDuration={0}>
                    <AuthGuard>{children}</AuthGuard>
                    <Toaster />
                  </TooltipProvider>
                </SidebarProvider>
              </ReportProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
