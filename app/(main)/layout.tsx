import type React from "react"

import { MainContent } from "@/components/main-content"
import { Sidebar } from "@/components/sidebar"

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
