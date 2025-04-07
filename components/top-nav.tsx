"use client"
import { ThemeToggle } from "./theme-toggle"
import { LanguageSwitcher } from "./language-switcher"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSettings } from "@/contexts/settings-context"
import { useLanguage } from "@/contexts/language-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import React from "react"

export function TopNav() {
  const pathname = usePathname()
  const pathSegments = pathname.split("/").filter(Boolean)
  const { settings } = useSettings()
  const { t, language } = useLanguage()

  // 路径段落的翻译映射
  const pathTranslations = {
    en: {
      tools: "Tools",
      settings: "Settings",
      reports: "Reports",
      upload: "Upload",
      analysis: "Analysis",
      chat: "Chat",
      // 添加分析模块下的子页面翻译
      ancestry: "Ancestry",
      health: "Health",
      traits: "Traits",
      "raw-data": "Raw Data",
      clinvar: "ClinVar",
    },
    "zh-CN": {
      tools: "工具",
      settings: "设置",
      reports: "报告",
      upload: "上传",
      analysis: "分析",
      chat: "聊天",
      // 添加分析模块下的子页面翻译
      ancestry: "祖源分析",
      health: "健康风险",
      traits: "特征分析",
      "raw-data": "原始数据",
      clinvar: "临床变异",
    }
  }

  // 获取当前页面标题
  const getPageTitle = () => {
    if (pathSegments.length === 0) return t("home")
    const lastSegment = pathSegments[pathSegments.length - 1]
    
    // 尝试从翻译映射中获取翻译
    const translatedSegment = pathTranslations[language][lastSegment]
    if (translatedSegment) return translatedSegment
    
    // 如果没有找到翻译，则使用首字母大写的原始段落
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
  }

  // 获取路径段落的翻译
  const getTranslatedSegment = (segment: string) => {
    const translatedSegment = pathTranslations[language][segment]
    if (translatedSegment) return translatedSegment
    return segment.charAt(0).toUpperCase() + segment.slice(1)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background w-full">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* 桌面端显示面包屑导航 */}
        <div className="hidden md:block">
          <nav className="flex items-center space-x-2">
            <Link href="/" className="text-sm font-medium">
              {t("home")}
            </Link>
            {pathSegments.map((segment, index) => (
              <React.Fragment key={segment}>
                <div className="text-muted-foreground">/</div>
                <Link href={`/${pathSegments.slice(0, index + 1).join("/")}`} className="text-sm font-medium">
                  {getTranslatedSegment(segment)}
                </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>
        
        {/* 移动端显示当前页面标题 */}
        <div className="md:hidden">
          <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
        </div>
        
        {/* 右侧按钮组 - 在所有屏幕尺寸下都显示 */}
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={settings.avatar} alt={settings.fullName} />
                  <AvatarFallback>
                    {settings.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{settings.fullName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{settings.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/tools/settings">{t("profile")}</Link>
              </DropdownMenuItem>
              {/* <DropdownMenuItem asChild>
                <Link href="/tools/sharing">{t("dataSharing")}</Link>
              </DropdownMenuItem> */}
              <DropdownMenuItem>{t("logOut")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

