"use client"

import { useSidebar } from "@/components/sidebar-context"
import { TopNav } from "@/components/top-nav"
import { cn } from "@/lib/utils"
import React from "react"

export function MainContent({ children }: { children: React.ReactNode }) {
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