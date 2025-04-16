"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  // 默认不折叠
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleSidebar = () => {
    // 只在移动设备上切换侧边栏状态
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsCollapsed(!isCollapsed)
    }
    // 桌面设备上不执行任何操作
  }

  return <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>{children}</SidebarContext.Provider>
}
