"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/language-context"

export default function AuthPage() {
  const { language } = useLanguage()
  const [fullName, setFullName] = useState("")
  
  const translations = {
    en: {
      welcome: "Welcome to Rootara",
      description: "Sign in to your account or create a new one",
      login: "Login",
      register: "Register",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      fullName: "Full Name",
      signIn: "Sign In",
      createAccount: "Create Account",
      forgotPassword: "Forgot Password?"
    },
    "zh-CN": {
      welcome: "欢迎使用 Rootara",
      description: "登录您的账户或创建新账户",
      login: "登录",
      register: "注册",
      email: "电子邮箱",
      password: "密码",
      confirmPassword: "确认密码",
      fullName: "全名",
      signIn: "登录",
      createAccount: "创建账户",
      forgotPassword: "忘记密码？"
    }
  }

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || key
  }

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <img src="/placeholder-logo.svg" alt="Logo" className="h-8 w-8 mr-2" />
          Rootara
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "Discover your genetic heritage and unlock insights about your health and traits."
            </p>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <Card>
            <CardHeader>
              <CardTitle>{t("welcome")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">{t("login")}</TabsTrigger>
                  <TabsTrigger value="register">{t("register")}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")}</Label>
                    <Input id="email" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("password")}</Label>
                    <Input id="password" type="password" />
                  </div>
                  <Button className="w-full">{t("signIn")}</Button>
                  <div className="text-center">
                    <a href="#" className="text-sm text-primary hover:underline">
                      {t("forgotPassword")}
                    </a>
                  </div>
                </TabsContent>

                <TabsContent value="register" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t("email")}</Label>
                    <Input id="register-email" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full-name">{t("fullName")}</Label>
                    <Input 
                      id="full-name" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t("password")}</Label>
                    <Input id="register-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  <Button className="w-full">{t("createAccount")}</Button>
                </TabsContent>
              </Tabs>

              <div className="relative my-4">
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}