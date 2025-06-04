"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Moon, Sun } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [language, setLanguage] = useState<"en" | "zh-CN">("en")
  const { login, isLoading } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Load language preference from localStorage on initial render
  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as "en" | "zh-CN"
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "zh-CN")) {
      setLanguage(savedLanguage)
    }
  }, [])

  const handleLanguageChange = (newLanguage: "en" | "zh-CN") => {
    setLanguage(newLanguage)
    localStorage.setItem("language", newLanguage)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError(language === "en" ? "Please enter both email and password" : "请输入邮箱和密码")
      return
    }

    const success = await login(email, password)
    if (success) {
      router.push("/")
    } else {
      setError(language === "en" ? "Invalid email or password" : "邮箱或密码错误")
    }
  }

  // Translations
  const translations = {
    en: {
      welcomeBack: "Welcome to Rootara",
      enterCredentials: "Enter your credentials to access your genetic data",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      signingIn: "Signing in...",
      emailPlaceholder: "name@example.com",
    },
    "zh-CN": {
      welcomeBack: "欢迎使用 Rootara",
      enterCredentials: "请输入您的凭据以访问您的基因数据",
      email: "邮箱",
      password: "密码",
      signIn: "登录",
      signingIn: "登录中...",
      emailPlaceholder: "name@example.com",
    },
  }

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key]
  }

  return (
    <div className="min-h-screen w-full flex">
      {/* Left side - Background image and branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/90 to-primary/70 relative">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-12">
          <img
            src="/rootara_logo_rmbg_small.svg"
            alt="Rootara"
            className="h-20 w-auto mb-6"
          />
          <p className="text-xl max-w-md text-center">
            {language === "en"
              ? "Discover your genetic heritage and unlock insights about your health and traits."
              : "探索您的基因，解锁您的遗传健康和个人特征。"}
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleLanguageChange(language === "en" ? "zh-CN" : "en")}
            title={language === "en" ? "Switch to Chinese" : "切换为英文"}
          >
            {language === "en" ? (
              <span className="font-bold text-sm">EN</span>
            ) : (
              <span className="font-bold text-sm">中</span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={
              theme === "dark"
                ? language === "en"
                  ? "Light mode"
                  : "亮色模式"
                : language === "en"
                  ? "Dark mode"
                  : "暗色模式"
            }
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4 lg:hidden">
              <img
                src="/rootara_logo_rmbg_small.svg"
                alt="Rootara"
                className="h-12 w-auto"
              />
            </div>
            <CardTitle className="text-2xl text-center">{t("welcomeBack")}</CardTitle>
            <CardDescription className="text-center">{t("enterCredentials")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("password")}</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? t("signingIn") : t("signIn")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
