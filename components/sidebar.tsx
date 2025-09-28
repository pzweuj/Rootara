"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  BarChart2,
  FileText,
  Dna,
  Heart,
  User,
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useSidebar } from "./sidebar-context"
import { useLanguage } from "@/contexts/language-context"

export function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const { t } = useLanguage()

  useEffect(() => {
    // 当路径变化时，根据当前路径自动展开相关菜单
    const newOpenItems: Record<string, boolean> = {}
    navigation.forEach((item) => {
      if (
        item.children &&
        item.children.some(
          (child) =>
            pathname === child.href || pathname.startsWith(child.href + "/")
        )
      ) {
        newOpenItems[item.name] = true
      }
    })
    setOpenItems(newOpenItems)
  }, [pathname])

  const navigation = [
    { name: t("dashboard"), href: "/", icon: Home },
    {
      name: t("analysisModules"),
      href: "/analysis",
      icon: BarChart2,
      children: [
        { name: t("ancestryAnalysis"), href: "/analysis/ancestry", icon: Dna },
        {
          name: t("traitInterpretation"),
          href: "/analysis/traits",
          icon: User,
        },
        { name: "ClinVar", href: "/analysis/clinvar", icon: AlertCircle },
      ],
    },
    {
      name: t("myReports"),
      href: "/reports",
      icon: FileText,
      children: [
        { name: t("allReports"), href: "/reports" },
        { name: t("uploadNewReport"), href: "/reports/upload" },
      ],
    },
  ]

  const bottomNavigation = [{ name: t("about"), href: "/about", icon: Info }]

  const toggleItem = (name: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [name]: !prev[name],
    }))
  }

  const NavItem = ({
    item,
    level = 0,
    isBottom = false,
  }: {
    item: {
      name: string
      href: string
      icon?: React.ComponentType<{ className?: string }>
      children?: Array<{
        name: string
        href: string
        icon?: React.ComponentType<{ className?: string }>
        children?: Array<{
          name: string
          href: string
        }>
      }>
    }
    level?: number
    isBottom?: boolean
  }) => {
    const hasChildren = item.children && item.children.length > 0

    // 特殊处理子菜单项的活动状态
    let isActive = false

    if (level === 0) {
      // 父菜单项的活动状态判断 - 确保每个表达式都返回布尔值
      isActive =
        pathname === item.href
          ? true
          : item.href !== "/" && pathname.startsWith(item.href + "/")
            ? true
            : item.children &&
                item.children.some(
                  (child: {
                    href: string
                    children?: Array<{ href: string }>
                  }) =>
                    pathname === child.href ||
                    (child.href !== "/" &&
                      pathname.startsWith(child.href + "/")) ||
                    (child.children &&
                      child.children.some(
                        (grandchild) =>
                          pathname === grandchild.href ||
                          (grandchild.href !== "/" &&
                            pathname.startsWith(grandchild.href + "/"))
                      ))
                )
              ? true
              : false
    } else {
      // 子菜单项的活动状态判断 - 完全重写这部分逻辑

      // 精确匹配路径
      isActive = pathname === item.href

      // 特殊情况：如果是根路径且不是精确匹配，则不激活
      if (item.href === "/" && pathname !== "/") {
        isActive = false
      }

      // 特殊情况：如果当前路径以该项的路径开头，且该项不是"/reports"，则激活
      // 这样可以处理子路径的情况，但排除了"/reports"和"/reports/upload"的冲突
      if (
        !isActive &&
        item.href !== "/" &&
        item.href !== "/reports" &&
        pathname.startsWith(item.href + "/")
      ) {
        isActive = true
      }
    }

    const isOpen = openItems[item.name]

    if (hasChildren) {
      return (
        <>
          <Collapsible
            open={isOpen}
            onOpenChange={() => toggleItem(item.name)}
            className={cn("w-full", isCollapsed && "hidden")}
          >
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                  isCollapsed && "justify-center px-2",
                  level > 0 && "pl-6"
                )}
              >
                {item.icon && (
                  <item.icon
                    className={cn("h-4 w-4", !isCollapsed && "mr-3")}
                  />
                )}
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-4 space-y-2 mt-2">
                {item.children?.map((child) => (
                  <NavItem key={child.name} item={child} level={level + 1} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Show icon-only version when collapsed */}
          {isCollapsed && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => toggleItem(item.name)}
                    className={cn(
                      "flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="flex items-center gap-4"
                >
                  {item.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )
    }

    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={
                item.href.startsWith("http") ? "noopener noreferrer" : undefined
              }
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                isCollapsed && "justify-center px-2",
                level > 0 && !isCollapsed && "pl-6"
              )}
            >
              {item.icon && (
                <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
              )}
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="flex items-center gap-4">
              {item.name}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <button
        className="lg:hidden fixed bottom-4 left-4 z-[1002] p-2 bg-background rounded-md shadow-md"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[1000] bg-black/50"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 z-[1001] flex flex-col bg-background transition-all duration-300 ease-in-out border-r border-border",
          isCollapsed ? "w-[72px]" : "w-72",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="border-b border-border">
          <div
            className={cn(
              "flex h-16 items-center gap-2 px-4",
              isCollapsed && "justify-center px-2"
            )}
          >
            {!isCollapsed && (
              <Link
                href="/"
                className="flex items-center font-semibold"
                onClick={() => setIsMobileOpen(false)}
              >
                <img
                  src="/rootara_logo_rmbg_small.svg"
                  alt="Rootara"
                  className="h-8 w-auto dark:invert"
                />
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={cn("ml-auto h-8 w-8 lg:hidden", isCollapsed && "ml-0")}
              onClick={toggleSidebar}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform",
                  isCollapsed && "rotate-180"
                )}
              />
              <span className="sr-only">
                {isCollapsed ? "Expand" : "Collapse"} Sidebar
              </span>
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <nav className="flex-1 space-y-3 px-2 py-4">
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </nav>
        </div>
        <div className="border-t border-border p-2">
          <nav className="space-y-3">
            {bottomNavigation.map((item) => (
              <NavItem key={item.name} item={item} isBottom />
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
