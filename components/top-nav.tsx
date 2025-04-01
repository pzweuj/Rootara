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
  const { t } = useLanguage()

  return (
    <header className="sticky top-0 z-40 border-b bg-background w-full">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="hidden md:block">
          <nav className="flex items-center space-x-2">
            <Link href="/" className="text-sm font-medium">
              {t("home")}
            </Link>
            {pathSegments.map((segment, index) => (
              <React.Fragment key={segment}>
                <span className="text-muted-foreground">/</span>
                <Link href={`/${pathSegments.slice(0, index + 1).join("/")}`} className="text-sm font-medium">
                  {segment.charAt(0).toUpperCase() + segment.slice(1)}
                </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>
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
              <DropdownMenuItem asChild>
                <Link href="/tools/sharing">{t("dataSharing")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>{t("logOut")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

