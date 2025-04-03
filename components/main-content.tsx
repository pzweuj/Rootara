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
        // 移动设备上不设置左边距，让内容占满整个宽度
        "ml-0",
        // 大屏幕上根据侧边栏状态调整左边距
        isCollapsed ? "lg:ml-[72px]" : "lg:ml-72",
      )}
    >
      <TopNav />
      <div className="container mx-auto p-6 max-w-7xl">
        <main className="w-full">{children}</main>
      </div>
    </div>
  )
}