import { Sidebar } from "@/components/sidebar"
import { MainContent } from "@/components/main-content"
import type React from "react"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <MainContent>{children}</MainContent>
    </div>
  )
}
