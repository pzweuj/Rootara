import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider } from "@/components/sidebar-context"
import { LanguageProvider } from "@/contexts/language-context"
import { AuthProvider } from "@/contexts/auth-context"
import { AuthGuard } from "@/components/auth-guard"
import { ReportProvider } from "@/contexts/report-context"
import type React from "react"

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
